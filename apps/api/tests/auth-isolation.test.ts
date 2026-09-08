import http from 'http';
import app from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let server: http.Server;
let baseUrl: string;

beforeAll((done) => {
  server = app.listen(0, () => {
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      baseUrl = `http://localhost:${addr.port}`;
    }
    done();
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
  await prisma.$disconnect();
});

describe('API Authentication & Multi-Tenant Isolation', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let repoAId: string;
  let repoBId: string;
  let scanAId: string;
  let findingAId: string;

  const emailA = `alice-${Date.now()}@vibeguard.io`;
  const emailB = `bob-${Date.now()}@vibeguard.io`;
  const password = 'SecurePassword123!';

  test('1. Registration rejects invalid email and short passwords', async () => {
    // Bad email
    const res1 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'validpassword123' })
    });
    expect(res1.status).toBe(400);

    // Short password
    const res2 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@example.com', password: 'short' })
    });
    expect(res2.status).toBe(400);
  });

  test('2. User A and User B can register and receive JWT tokens', async () => {
    // Register User A
    const resA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password, name: 'Alice Tenant' })
    });
    expect(resA.status).toBe(201);
    const dataA = await resA.json();
    expect(dataA.token).toBeDefined();
    expect(dataA.user.email).toBe(emailA);
    userAToken = dataA.token;
    userAId = dataA.user.id;

    // Register User B
    const resB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password, name: 'Bob Tenant' })
    });
    expect(resB.status).toBe(201);
    const dataB = await resB.json();
    expect(dataB.token).toBeDefined();
    expect(dataB.user.email).toBe(emailB);
    userBToken = dataB.token;
    userBId = dataB.user.id;
  });

  test('3. Login validates credentials accurately', async () => {
    // Wrong password
    const resFail = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password: 'wrongpassword' })
    });
    expect(resFail.status).toBe(401);

    // Correct password
    const resOk = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password })
    });
    expect(resOk.status).toBe(200);
    const dataOk = await resOk.json();
    expect(dataOk.token).toBeDefined();
  });

  test('4. GET /api/auth/me requires valid token', async () => {
    const unauth = await fetch(`${baseUrl}/api/auth/me`);
    expect(unauth.status).toBe(401);

    const auth = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    expect(auth.status).toBe(200);
    const data = await auth.json();
    expect(data.user.id).toBe(userAId);
  });

  test('5. Repositories created by User A are inaccessible to User B', async () => {
    // User A creates repository
    const resA = await fetch(`${baseUrl}/api/repositories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ name: 'tenant-a-secrets-vault' })
    });
    expect(resA.status).toBe(201);
    const repoA = await resA.json();
    repoAId = repoA.id;

    // User B creates repository
    const resB = await fetch(`${baseUrl}/api/repositories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({ name: 'tenant-b-public-blog' })
    });
    expect(resB.status).toBe(201);
    const repoB = await resB.json();
    repoBId = repoB.id;

    // User A lists repositories: only sees repo A
    const listA = await fetch(`${baseUrl}/api/repositories`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const dataA = await listA.json();
    expect(dataA.some((r: any) => r.id === repoAId)).toBe(true);
    expect(dataA.some((r: any) => r.id === repoBId)).toBe(false);

    // User B lists repositories: only sees repo B
    const listB = await fetch(`${baseUrl}/api/repositories`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    const dataB = await listB.json();
    expect(dataB.some((r: any) => r.id === repoBId)).toBe(true);
    expect(dataB.some((r: any) => r.id === repoAId)).toBe(false);

    // Direct access: User B attempts to fetch User A's repo -> 404
    const directAccess = await fetch(`${baseUrl}/api/repositories/${repoAId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    expect(directAccess.status).toBe(404);
  });

  test('6. Scans and Findings are strictly isolated across tenants', async () => {
    // User A uploads scan
    const uploadRes = await fetch(`${baseUrl}/api/scans/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        repositoryName: 'tenant-a-secrets-vault',
        numericScore: 85,
        score: 'B',
        findings: [
          {
            scanner: 'Gitleaks',
            ruleId: 'generic-api-key',
            title: 'Hardcoded Secret In Prod',
            severity: 'CRITICAL',
            file: 'config/secrets.env',
            line: 4
          }
        ]
      })
    });
    expect(uploadRes.status).toBe(201);
    const scanA = await uploadRes.json();
    scanAId = scanA.id;
    findingAId = scanA.findings[0].id;

    // User A can see their scan and finding
    const scansA = await (await fetch(`${baseUrl}/api/scans`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    })).json();
    expect(scansA.some((s: any) => s.id === scanAId)).toBe(true);

    const findingsA = await (await fetch(`${baseUrl}/api/findings`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    })).json();
    expect(findingsA.some((f: any) => f.id === findingAId)).toBe(true);

    // User B CANNOT see User A's scan or findings
    const scansB = await (await fetch(`${baseUrl}/api/scans`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    })).json();
    expect(scansB.some((s: any) => s.id === scanAId)).toBe(false);

    const findingsB = await (await fetch(`${baseUrl}/api/findings`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    })).json();
    expect(findingsB.some((f: any) => f.id === findingAId)).toBe(false);

    // User B attempts direct GET /api/scans/:id -> 404
    const directScan = await fetch(`${baseUrl}/api/scans/${scanAId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    expect(directScan.status).toBe(404);
  });

  test('7. AI Remediation and Rescan Verification are blocked for unauthorized users', async () => {
    // User B tries to trigger AI remediation for User A's finding -> 403 Forbidden
    const aiRemediateRes = await fetch(`${baseUrl}/api/ai/remediate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        findingId: findingAId,
        codeContext: 'AWS_SECRET_KEY=12345'
      })
    });
    expect(aiRemediateRes.status).toBe(403);

    // User B tries to verify fix for User A's finding -> 403 Forbidden
    const aiVerifyRes = await fetch(`${baseUrl}/api/ai/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        findingId: findingAId,
        codeFix: 'AWS_SECRET_KEY=process.env.KEY'
      })
    });
    expect(aiVerifyRes.status).toBe(403);
  });

  test('8. Unauthenticated requests to protected endpoints return 401', async () => {
    const resRepos = await fetch(`${baseUrl}/api/repositories`);
    expect(resRepos.status).toBe(401);

    const resScans = await fetch(`${baseUrl}/api/scans`);
    expect(resScans.status).toBe(401);

    const resFindings = await fetch(`${baseUrl}/api/findings`);
    expect(resFindings.status).toBe(401);
  });
});
