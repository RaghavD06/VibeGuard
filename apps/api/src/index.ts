import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { ContextualExplainer, RescanVerifier } from '@maverick006/ai-engine';
import { requireAuth, AuthenticatedRequest, verifyRepositoryAccess } from './auth';
import authRouter from './routes/auth.routes';

// Load root .env and local .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Structured Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      timestamp: new Date().toISOString()
    }));
  });
  next();
});

// --- Health (Public) ---
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const totalScans = await prisma.scan.count();
    const successfulScans = await prisma.scan.count({ where: { status: 'COMPLETED' } });
    const failedScans = await prisma.scan.count({ where: { status: 'FAILED' } });
    
    const findingsCounts = await prisma.finding.groupBy({
      by: ['severity'],
      _count: true
    });

    const metrics = {
      totalScans,
      successfulScans,
      failedScans,
      findingsBySeverity: findingsCounts.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.severity] = curr._count;
        return acc;
      }, {} as Record<string, number>)
    };
    
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// --- Auth Routes (Public) ---
app.use('/api/auth', authRouter);

// --- Protected Routes (Multi-Tenant Isolation) ---

// Repositories
app.get('/api/repositories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const repos = await prisma.repository.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

app.get('/api/repositories/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await verifyRepositoryAccess(req.params.id, req.user!.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    res.json(repo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repository' });
  }
});

app.post('/api/repositories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, url } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Repository name is required' });
    }
    const userId = req.user!.id;
    const targetUrl = url || `https://github.com/${name}`;

    // Tenant-isolated check: Does user already have access to a repo with this name or url?
    let repo = await prisma.repository.findFirst({
      where: {
        AND: [
          {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } }
            ]
          },
          {
            OR: [
              { name },
              { url: targetUrl }
            ]
          }
        ]
      }
    });

    if (!repo) {
      repo = await prisma.repository.create({
        data: {
          name,
          url: targetUrl,
          ownerId: userId,
          members: {
            create: {
              userId,
              role: 'OWNER'
            }
          }
        }
      });
    }
    res.status(201).json(repo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create repository' });
  }
});

// Scans
app.get('/api/scans', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const scans = await prisma.scan.findMany({
      where: {
        repository: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } }
          ]
        }
      },
      include: { findings: true, repository: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(scans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

app.get('/api/scans/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const scan = await prisma.scan.findUnique({
      where: { id: req.params.id },
      include: { findings: true, repository: true }
    });

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const hasAccess = await verifyRepositoryAccess(scan.repositoryId, userId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(scan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scan' });
  }
});

app.post('/api/scans/upload', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { repositoryName, repositoryUrl, numericScore, score, findings } = req.body;
    
    const targetName = repositoryName || 'Local Project';
    const targetUrl = (repositoryUrl && repositoryUrl !== 'local') ? repositoryUrl : `local://${targetName}`;

    // Tenant-isolated lookup for repository belonging to this user
    let repository = await prisma.repository.findFirst({
      where: {
        AND: [
          {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } }
            ]
          },
          {
            OR: [
              { name: targetName },
              { url: targetUrl }
            ]
          }
        ]
      }
    });
    
    if (!repository) {
      repository = await prisma.repository.create({
        data: {
          name: targetName,
          url: targetUrl,
          ownerId: userId,
          members: {
            create: {
              userId,
              role: 'OWNER'
            }
          }
        }
      });
    }
    
    // Create scan with findings
    const scan = await prisma.scan.create({
      data: {
        repositoryId: repository.id,
        status: 'COMPLETED',
        numericScore,
        score,
        completedAt: new Date(),
        findings: {
          create: (findings || []).map((f: any) => {
            const rawFingerprint = f.fingerprint || `${f.scanner}-${f.ruleId}-${f.file}-${f.line}`;
            const fingerprint = crypto.createHash('sha256').update(rawFingerprint).digest('hex');
            
            return {
              scanner: f.scanner || 'VibeGuard',
              title: f.title || 'Unknown Finding',
              description: f.description || '',
              severity: f.severity || 'INFO',
              file: f.file,
              line: f.line,
              column: f.column,
              codeSnippet: f.codeSnippet,
              ruleId: f.ruleId,
              category: f.category,
              remediation: f.remediation,
              fingerprint
            };
          })
        }
      },
      include: { findings: true, repository: true }
    });
    
    res.status(201).json(scan);
  } catch (error) {
    console.error('Failed to upload scan:', error);
    res.status(500).json({ error: 'Failed to upload scan' });
  }
});

// Findings
app.get('/api/findings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const findings = await prisma.finding.findMany({
      where: {
        scan: {
          repository: {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } }
            ]
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: { scan: { include: { repository: true } } }
    });
    res.json(findings);
  } catch (error) {
    console.error('Error fetching findings:', error);
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
});

app.post('/api/findings/resolve-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { repositoryName } = req.body;

    const whereCondition: any = {
      scan: {
        repository: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } }
          ]
        }
      }
    };

    if (repositoryName && repositoryName !== 'all') {
      whereCondition.scan.repository.name = repositoryName;
    }
    
    await prisma.finding.updateMany({
      where: whereCondition,
      data: { status: 'RESOLVED' }
    });
    
    res.json({ message: 'All findings marked as resolved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve findings' });
  }
});

app.patch('/api/findings/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status } = req.body;

    const finding = await prisma.finding.findUnique({
      where: { id: req.params.id },
      include: { scan: true }
    });

    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const hasAccess = await verifyRepositoryAccess(finding.scan.repositoryId, userId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const updated = await prisma.finding.update({
      where: { id: req.params.id },
      data: { status: status || 'RESOLVED' }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

// --- Server-side NVIDIA NIM AI Remediation ---
app.post('/api/ai/remediate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { finding, findingId, codeContext } = req.body;

    const targetFinding = finding || (findingId ? await prisma.finding.findUnique({ where: { id: findingId }, include: { scan: true } }) : null);

    if (!targetFinding) {
      return res.status(400).json({ error: 'Finding or findingId is required' });
    }

    // Tenant isolation verification: If finding belongs to a scan, check repository access
    if (targetFinding.scanId) {
      const dbFinding = await prisma.finding.findUnique({
        where: { id: targetFinding.id },
        include: { scan: true }
      });
      if (dbFinding) {
        const hasAccess = await verifyRepositoryAccess(dbFinding.scan.repositoryId, userId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Forbidden: Access to this finding is denied' });
        }
      }
    }

    const explainer = new ContextualExplainer();
    const explanation = await explainer.explainFinding(targetFinding, { codeContext });
    res.json(explanation);
  } catch (err: any) {
    console.error('AI remediation error:', err);
    res.status(500).json({ error: 'Failed to generate remediation', message: err.message });
  }
});

// --- Rescan Verification Engine ---
app.post('/api/ai/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { finding, findingId, codeFix, filePath } = req.body;

    const targetFinding = finding || (findingId ? await prisma.finding.findUnique({ where: { id: findingId }, include: { scan: true } }) : null);

    if (!targetFinding || !codeFix) {
      return res.status(400).json({ error: 'Finding and codeFix are required' });
    }

    // Tenant authorization check
    if (targetFinding.id) {
      const dbFinding = await prisma.finding.findUnique({
        where: { id: targetFinding.id },
        include: { scan: true }
      });
      if (dbFinding) {
        const hasAccess = await verifyRepositoryAccess(dbFinding.scan.repositoryId, userId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Forbidden: Access to this finding is denied' });
        }
      }
    }

    let scanner: any;
    const scannerName = (targetFinding.scanner || '').toLowerCase();
    try {
      if (scannerName.includes('semgrep')) {
        const { SemgrepScanner } = require('@maverick006/scanner-semgrep');
        scanner = new SemgrepScanner();
      } else if (scannerName.includes('gitleaks')) {
        const { GitleaksScanner } = require('@maverick006/scanner-gitleaks');
        scanner = new GitleaksScanner();
      } else if (scannerName.includes('npm') || scannerName.includes('audit')) {
        const { NpmAuditScanner } = require('@maverick006/scanner-npm-audit');
        scanner = new NpmAuditScanner();
      } else if (scannerName.includes('trivy')) {
        const { TrivyScanner } = require('@maverick006/scanner-trivy');
        scanner = new TrivyScanner();
      } else if (scannerName.includes('checkov')) {
        const { CheckovScanner } = require('@maverick006/scanner-checkov');
        scanner = new CheckovScanner();
      }
    } catch {}

    if (!scanner) {
      return res.json({
        originalFinding: targetFinding,
        status: 'NOT_VERIFIED',
        message: `Rescan verification not available for scanner '${targetFinding.scanner}' in this environment.`
      });
    }

    const verifier = new RescanVerifier();
    const result = await verifier.verifyPatch({
      finding: targetFinding,
      codeFix,
      scanner,
      filePath: filePath || targetFinding.file || 'patch_fix.ts'
    });

    // If verified clean and finding exists in DB, update status
    if (result.status === 'VERIFIED' && targetFinding.id) {
      try {
        await prisma.finding.update({
          where: { id: targetFinding.id },
          data: { status: 'VERIFIED' }
        });
      } catch {}
    }

    res.json(result);
  } catch (err: any) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed', message: err.message });
  }
});

// --- Server Startup ---
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`VibeGuard API Server running on port ${PORT} (Prisma / SQLite)`);
  });
}

export default app;

