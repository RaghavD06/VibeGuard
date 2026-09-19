import crypto from 'crypto';
import { rateLimit, Store, Options } from 'express-rate-limit';
import { prisma } from './prisma';
import { AuthenticatedRequest } from './auth';

/** Atomic PostgreSQL counters are shared by every API replica. */
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60_000;
  private nextCleanup = 0;
  constructor(public readonly prefix: string) {}
  init(options: Options): void { this.windowMs = options.windowMs; }
  private key(value: string): string {
    return `${this.prefix}:${crypto.createHash('sha256').update(value).digest('hex')}`;
  }
  async increment(value: string) {
    if (Date.now() >= this.nextCleanup) {
      this.nextCleanup = Date.now() + 60_000;
      await prisma.rateLimitBucket.deleteMany({ where: { resetTime: { lt: new Date() } } });
    }
    const rows = await prisma.$queryRaw<{ totalHits: number; resetTime: Date }[]>`
      INSERT INTO "RateLimitBucket" ("key", "totalHits", "resetTime")
      VALUES (${this.key(value)}, 1, NOW() + (${this.windowMs}::double precision * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "totalHits" = CASE WHEN "RateLimitBucket"."resetTime" <= NOW() THEN 1 ELSE "RateLimitBucket"."totalHits" + 1 END,
        "resetTime" = CASE WHEN "RateLimitBucket"."resetTime" <= NOW()
          THEN NOW() + (${this.windowMs}::double precision * INTERVAL '1 millisecond') ELSE "RateLimitBucket"."resetTime" END
      RETURNING "totalHits", "resetTime"`;
    return rows[0];
  }
  async decrement(value: string) {
    await prisma.rateLimitBucket.updateMany({
      where: { key: this.key(value), totalHits: { gt: 0 } }, data: { totalHits: { decrement: 1 } }
    });
  }
  async resetKey(value: string) {
    await prisma.rateLimitBucket.deleteMany({ where: { key: this.key(value) } });
  }
}

export function sharedRateLimit(scope: string, limit: number, authenticated = false) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, limit,
    store: new PostgresRateLimitStore(scope),
    standardHeaders: 'draft-7', legacyHeaders: false,
    ...(authenticated ? { keyGenerator: (req: AuthenticatedRequest) => req.user!.id } : {}),
    message: { error: scope === 'auth' ? 'Too many authentication attempts. Try again later.' : 'Request limit reached. Try again later.' }
  });
}
