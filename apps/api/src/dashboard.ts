import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest, requireAuth } from './auth';
import { prisma } from './prisma';

const router = Router();
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const repositoryName = typeof req.query.repository === 'string' ? req.query.repository : null;
    const repository = {
      ...(repositoryName ? { name: repositoryName } : {}),
      OR: [{ ownerId: userId }, { members: { some: { userId } } }]
    };
    const accessible = Prisma.sql`(r."ownerId" = ${userId} OR EXISTS (
      SELECT 1 FROM "RepositoryMember" m WHERE m."repositoryId" = r.id AND m."userId" = ${userId}
    )) AND (${repositoryName}::text IS NULL OR r.name = ${repositoryName})`;
    const [totalScans, latestScan, counts, trend] = await Promise.all([
      prisma.scan.count({ where: { repository } }),
      prisma.scan.findFirst({ where: { repository }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      prisma.$queryRaw<{ severity: string; count: number }[]>(Prisma.sql`
        WITH latest AS (
          SELECT DISTINCT ON (s."repositoryId") s.id
          FROM "Scan" s JOIN "Repository" r ON r.id = s."repositoryId"
          WHERE ${accessible}
          ORDER BY s."repositoryId", s."createdAt" DESC, s.id DESC
        )
        SELECT UPPER(f.severity) AS severity, COUNT(*)::int AS count
        FROM "Finding" f JOIN latest ON latest.id = f."scanId"
        WHERE f.status NOT IN ('DISMISSED', 'RESOLVED') GROUP BY UPPER(f.severity)`),
      prisma.$queryRaw<{ day: string; severity: string; count: number }[]>(Prisma.sql`
        SELECT TO_CHAR(f."createdAt", 'YYYY-MM-DD') AS day, UPPER(f.severity) AS severity, COUNT(*)::int AS count
        FROM "Finding" f JOIN "Scan" s ON s.id = f."scanId" JOIN "Repository" r ON r.id = s."repositoryId"
        WHERE ${accessible} AND f."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day, UPPER(f.severity) ORDER BY day`)
    ]);
    res.json({ totalScans, latestScan, counts, trend });
  } catch {
    res.status(503).json({ error: 'Dashboard data is unavailable' });
  }
});
export default router;
