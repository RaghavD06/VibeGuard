import http from 'http';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { createToken } from '../src/auth';

let server: http.Server;
let base: string;
let tokenA: string;
let tokenB: string;
let memberToken: string;
let memberId: string;
let repositoryId: string;
let scanId: string;
beforeAll(async () => {
  const a = await prisma.user.create({ data: { email: 'page-a@example.test' } });
  const b = await prisma.user.create({ data: { email: 'page-b@example.test' } });
  const member = await prisma.user.create({ data: { email: 'member@example.test' } });
  tokenA = createToken(a); tokenB = createToken(b); memberToken = createToken(member); memberId = member.id;
  const repo = await prisma.repository.create({ data: { name: 'large', url: 'local://large', ownerId: a.id, members: { create: { userId: member.id } } } });
  repositoryId = repo.id;
  const old = await prisma.scan.create({ data: { repositoryId, status: 'PARTIAL', createdAt: new Date('2026-01-01') } });
  await prisma.finding.create({ data: { scanId: old.id, scanner: 'Gitleaks', title: 'Historical finding', description: '', severity: 'CRITICAL' } });
  const scan = await prisma.scan.create({ data: { repositoryId, status: 'PARTIAL', createdAt: new Date('2026-02-01') } });
  scanId = scan.id;
  await prisma.finding.createMany({ data: Array.from({ length: 205 }, (_, i) => ({ scanId, scanner: 'Semgrep', title: `Finding ${i}`, description: '', severity: 'HIGH', createdAt: new Date('2026-02-01') })) });
  await new Promise<void>(resolve => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; resolve(); }); });
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });
const get = (path: string, token = tokenA) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });

test('cursor pages return every finding exactly once even with identical timestamps', async () => {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const response = await get(`/api/findings?limit=100&scanId=${scanId}${cursor ? `&cursor=${cursor}` : ''}`);
    expect(response.status).toBe(200);
    const rows = await response.json();
    expect(rows.length).toBeLessThanOrEqual(100);
    ids.push(...rows.map((row: any) => row.id));
    cursor = response.headers.get('X-Next-Cursor');
  } while (cursor);
  expect(ids.length).toBe(205);
  expect(new Set(ids).size).toBe(205);
});

test('foreign cursors and scan filters never confer tenant access', async () => {
  const first = await get('/api/findings?limit=1');
  const cursor = first.headers.get('X-Next-Cursor');
  const response = await get(`/api/findings?scanId=${scanId}&cursor=${cursor}`, tokenB);
  expect(await response.json()).toEqual([]);
  expect((await get('/api/findings?limit=10000')).status).toBe(400);
  expect((await get('/api/scans?cursor=malformed')).status).toBe(400);
});

test('dashboard aggregates all latest-scan findings, not just the first page', async () => {
  const dashboard = await (await get('/api/dashboard')).json();
  expect(dashboard.totalScans).toBe(2);
  expect(dashboard.latestScan.id).toBe(scanId);
  expect(dashboard.counts).toEqual([{ severity: 'HIGH', count: 205 }]);
  expect((await (await get('/api/dashboard', tokenB)).json()).totalScans).toBe(0);
  const scans = await (await get('/api/scans')).json();
  expect(scans[0].findings).toBeUndefined();
  expect(scans[0]._count.findings).toBe(205);
});

test('current membership grants access and removing it immediately revokes access', async () => {
  expect((await get(`/api/scans/${scanId}`, memberToken)).status).toBe(200);
  await prisma.repositoryMember.deleteMany({ where: { repositoryId, userId: memberId } });
  expect((await get(`/api/scans/${scanId}`, memberToken)).status).toBe(404);
  await prisma.user.delete({ where: { id: memberId } });
  expect((await get('/api/auth/me', memberToken)).status).toBe(401);
});
