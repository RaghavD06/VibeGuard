import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { ContextualExplainer, RescanVerifier } from '@maverick006/ai-engine';
import { calculateScore as calculateEngineScore } from '@maverick006/security-engine';
import { NormalizedFinding, Severity, ScannerCoverage } from '@maverick006/types';
import { requireAuth, AuthenticatedRequest, verifyRepositoryAccess } from './auth';
import authRouter from './routes/auth.routes';
import { prisma } from './prisma';
import { sharedRateLimit } from './rate-limit';
import { pagination, sendPage, findingKind } from './pagination';
import dashboardRouter from './dashboard';

// Load root .env and local .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
const PORT = process.env.PORT || 3001;
const configuredOrigins = (process.env.CORS_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean);

app.use(cors({
  exposedHeaders: ['X-Next-Cursor'],
  origin(origin, callback) {
    if (process.env.NODE_ENV !== 'production' || !origin || configuredOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS policy'));
  }
}));
app.use(express.json({ limit: '1mb' }));

const VALID_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
const VALID_FINDING_STATUSES = new Set(['OPEN', 'DISMISSED']);
const VALID_GRADES = new Set(['A', 'B', 'C', 'D', 'F', 'UNASSESSED']);
const COVERAGE_DOMAINS: (keyof ScannerCoverage)[] = ['code', 'dependencies', 'secrets', 'containers', 'iac', 'web', 'cloud'];

function asTrimmedString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

function toNormalizedFinding(finding: {
  id: string; scanId: string; scanner: string; scannerVersion: string | null; ruleId: string | null;
  title: string; description: string; severity: string; confidence: string | null; category: string | null;
  owasp: string | null; cwe: string | null; file: string | null; line: number | null; column: number | null;
  codeSnippet: string | null; fingerprint: string | null; remediation: string | null; status: string;
}): NormalizedFinding {
  return {
    id: finding.id,
    scanId: finding.scanId,
    scanner: finding.scanner,
    scannerVersion: finding.scannerVersion || undefined,
    ruleId: finding.ruleId || undefined,
    title: finding.title,
    description: finding.description,
    severity: (VALID_SEVERITIES.has(finding.severity) ? finding.severity : 'INFO') as Severity,
    confidence: finding.confidence as NormalizedFinding['confidence'],
    category: finding.category || undefined,
    owasp: finding.owasp || undefined,
    cwe: finding.cwe || undefined,
    file: finding.file || undefined,
    line: finding.line || undefined,
    column: finding.column || undefined,
    codeSnippet: finding.codeSnippet || undefined,
    fingerprint: finding.fingerprint || undefined,
    remediation: finding.remediation || undefined,
    status: finding.status as NormalizedFinding['status']
  };
}

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
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database readiness timed out')), 3_000))
    ]);
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

app.get('/metrics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = { repository: { OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] } };
    const totalScans = await prisma.scan.count({ where: access });
    const successfulScans = await prisma.scan.count({ where: { ...access, status: 'COMPLETED' } });
    const failedScans = await prisma.scan.count({ where: { ...access, status: 'FAILED' } });
    
    const findingsCounts = await prisma.finding.groupBy({
      by: ['severity'],
      _count: true,
      where: { scan: access }
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
app.use('/api/dashboard', dashboardRouter);

// --- Protected Routes (Multi-Tenant Isolation) ---

// Repositories
app.get('/api/repositories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = pagination(req);
    const repos = await prisma.repository.findMany({
      where: {
        AND: page.where,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      orderBy: page.orderBy,
      take: page.limit + 1
    });
    sendPage(res, repos, page.limit);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid pagination') return res.status(400).json({ error: error.message });
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
    const repositoryName = asTrimmedString(name, 200);
    if (!repositoryName) {
      return res.status(400).json({ error: 'Repository name is required' });
    }
    if (url !== undefined && (typeof url !== 'string' || url.length > 2_000)) {
      return res.status(400).json({ error: 'Repository URL is invalid' });
    }
    const userId = req.user!.id;
    const targetUrl = url || `https://github.com/${repositoryName}`;

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
              { name: repositoryName },
              { url: targetUrl }
            ]
          }
        ]
      }
    });

    if (!repo) {
      repo = await prisma.repository.create({
        data: {
          name: repositoryName,
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
    const page = pagination(req);
    const scans = await prisma.scan.findMany({
      where: {
        AND: page.where,
        repository: {
          ...(typeof req.query.repository === 'string' ? { name: req.query.repository } : {}),
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } }
          ]
        }
      },
      include: { repository: true, _count: { select: { findings: true } } },
      orderBy: page.orderBy,
      take: page.limit + 1
    });
    sendPage(res, scans, page.limit);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid pagination') return res.status(400).json({ error: error.message });
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

app.post('/api/scans/upload', requireAuth, sharedRateLimit('upload', 60, true), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { repositoryName, repositoryUrl, numericScore, score, findings, coverage } = req.body;
    if (repositoryName !== undefined && !asTrimmedString(repositoryName, 200)) {
      return res.status(400).json({ error: 'Repository name is invalid' });
    }
    if (repositoryUrl !== undefined && (typeof repositoryUrl !== 'string' || repositoryUrl.length > 2_000)) {
      return res.status(400).json({ error: 'Repository URL is invalid' });
    }
    if (numericScore !== null && numericScore !== undefined && (!Number.isInteger(numericScore) || numericScore < 0 || numericScore > 100)) {
      return res.status(400).json({ error: 'numericScore must be an integer from 0 to 100 or null' });
    }
    if (score !== null && score !== undefined && (typeof score !== 'string' || !VALID_GRADES.has(score))) {
      return res.status(400).json({ error: 'score is invalid' });
    }
    if (!Array.isArray(findings) || findings.length > 5_000) {
      return res.status(400).json({ error: 'findings must be an array with at most 5000 entries' });
    }
    if (coverage !== undefined && (typeof coverage !== 'object' || coverage === null || Array.isArray(coverage) ||
        COVERAGE_DOMAINS.some(domain => typeof coverage[domain] !== 'boolean'))) {
      return res.status(400).json({ error: 'coverage must specify all seven scanner domains as booleans' });
    }
    for (const finding of findings) {
      if (!finding || typeof finding !== 'object' || !asTrimmedString(finding.title, 1_000) || !VALID_SEVERITIES.has(String(finding.severity || 'INFO').toUpperCase())) {
        return res.status(400).json({ error: 'Each finding requires a title and a valid severity' });
      }
    }
    const assessedCoverage = Object.fromEntries(COVERAGE_DOMAINS.map(domain => [domain, coverage?.[domain] === true])) as unknown as ScannerCoverage;
    const derivedScore = calculateEngineScore(findings.map((f: any) => ({
      scanner: typeof f.scanner === 'string' ? f.scanner : 'VibeGuard',
      title: f.title,
      description: typeof f.description === 'string' ? f.description : '',
      severity: String(f.severity || 'INFO').toUpperCase() as Severity
    })), assessedCoverage);

    const targetName = asTrimmedString(repositoryName, 200) || 'Local Project';
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
        status: derivedScore.status === 'COMPLETE' ? 'COMPLETED' : derivedScore.status,
        numericScore: derivedScore.score,
        score: derivedScore.grade,
        coverage: JSON.stringify(assessedCoverage),
        completedAt: new Date(),
        findings: {
          create: findings.map((f: any) => {
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
    console.error('Failed to upload scan');
    res.status(500).json({ error: 'Failed to upload scan' });
  }
});

// Findings
app.get('/api/findings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = pagination(req);
    const findings = await prisma.finding.findMany({
      where: {
        AND: [page.where, findingKind(req.query.kind)],
        ...(typeof req.query.scanId === 'string' ? { scanId: req.query.scanId } : {}),
        ...(typeof req.query.scanner === 'string' ? { scanner: { contains: req.query.scanner, mode: 'insensitive' as const } } : {}),
        scan: {
          repository: {
            ...(typeof req.query.repository === 'string' ? { name: req.query.repository } : {}),
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } }
            ]
          }
        }
      },
      orderBy: page.orderBy,
      take: page.limit + 1,
      include: { scan: { include: { repository: true } } }
    });
    sendPage(res, findings, page.limit);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid pagination') return res.status(400).json({ error: error.message });
    console.error('Failed to fetch findings');
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
});

app.post('/api/findings/dismiss-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
    
    const result = await prisma.finding.updateMany({
      where: whereCondition,
      data: { status: 'DISMISSED' }
    });
    
    res.json({ message: 'Findings dismissed by user; no fix was verified', count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss findings' });
  }
});

app.patch('/api/findings/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status } = req.body;
    if (typeof status !== 'string' || !VALID_FINDING_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Finding status is invalid' });
    }

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
      data: { status }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

// --- Server-side NVIDIA NIM AI Remediation ---
const aiLimit = sharedRateLimit('ai', 30, true);
app.post('/api/ai/remediate', requireAuth, aiLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { findingId, codeContext } = req.body;

    const targetFinding = typeof findingId === 'string'
      ? await prisma.finding.findUnique({ where: { id: findingId }, include: { scan: true } })
      : null;

    if (!targetFinding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const hasAccess = await verifyRepositoryAccess(targetFinding.scan.repositoryId, userId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const explainer = new ContextualExplainer();
    const explanation = await explainer.explainFinding(toNormalizedFinding(targetFinding), { codeContext: typeof codeContext === 'string' ? codeContext.slice(0, 2_000) : undefined });
    res.json(explanation);
  } catch (err: any) {
    console.error('AI remediation failed');
    res.status(500).json({ error: 'Failed to generate remediation' });
  }
});

// --- Rescan Verification Engine ---
app.post('/api/ai/verify', requireAuth, sharedRateLimit('verify', 10, true), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { findingId, codeFix, originalFileContent, filePath } = req.body;

    const targetFinding = typeof findingId === 'string'
      ? await prisma.finding.findUnique({ where: { id: findingId }, include: { scan: true } })
      : null;

    if (!targetFinding) {
      return res.status(404).json({ error: 'Finding not found' });
    }
    const hasAccess = await verifyRepositoryAccess(targetFinding.scan.repositoryId, userId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Finding not found' });
    }
    if (typeof codeFix !== 'string' || !codeFix.trim() || codeFix.length > 100_000 ||
        typeof originalFileContent !== 'string' || !originalFileContent.trim() || originalFileContent.length > 100_000 ||
        (filePath !== undefined && (typeof filePath !== 'string' || filePath.length > 1000))) {
      return res.status(400).json({ error: 'A valid findingId, originalFileContent, and codeFix are required' });
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
      finding: toNormalizedFinding(targetFinding),
      codeFix,
      originalFileContent,
      scanner,
      filePath: filePath || targetFinding.file || 'patch_fix.ts'
    });

    res.json(result);
  } catch (err: any) {
    console.error('Verification failed');
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Express's default error page can expose implementation details in development.
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body exceeds the 1 MB limit' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Malformed JSON request body' });
  }
  if (error?.message === 'Origin is not allowed by CORS policy') {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }
  return res.status(500).json({ error: 'Internal server error' });
});

// --- Server Startup ---
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`VibeGuard API Server running on port ${PORT} (Prisma / PostgreSQL)`);
  });
}

export default app;

