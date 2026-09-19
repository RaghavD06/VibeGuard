import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

export function findingKind(kind: unknown): Prisma.FindingWhereInput {
  const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
  if (kind === 'secrets') return { OR: [{ scanner: contains('gitleaks') }, { category: 'secrets' }] };
  if (kind === 'dependencies') return { OR: [{ scanner: contains('npm') }, { scanner: contains('trivy') }, { category: 'dependency' }] };
  if (kind === 'containers') return { OR: [{ scanner: contains('trivy') }, { category: 'container' }, { file: contains('Dockerfile') }] };
  if (kind === 'iac') return { OR: [{ scanner: contains('checkov') }, { category: 'iac' }, { file: { endsWith: '.tf' } }] };
  return {};
}

export function pagination(req: Request) {
  const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid pagination');
  let after: { createdAt: Date; id: string } | undefined;
  if (req.query.cursor !== undefined) {
    if (typeof req.query.cursor !== 'string' || req.query.cursor.length > 512) throw new Error('Invalid pagination');
    try {
      const value = JSON.parse(Buffer.from(req.query.cursor, 'base64url').toString());
      if (typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value.id) ||
          typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error();
      after = { id: value.id, createdAt: new Date(value.createdAt) };
    } catch { throw new Error('Invalid pagination'); }
  }
  return {
    limit,
    where: after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {},
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
  };
}

export function sendPage<T extends { id: string; createdAt: Date }>(res: Response, rows: T[], limit: number) {
  const more = rows.length > limit;
  const items = rows.slice(0, limit);
  if (more) {
    const last = items[items.length - 1];
    res.setHeader('X-Next-Cursor', Buffer.from(JSON.stringify({ id: last.id, createdAt: last.createdAt })).toString('base64url'));
  }
  return res.json(items);
}
