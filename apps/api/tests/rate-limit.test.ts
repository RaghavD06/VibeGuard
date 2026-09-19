import { Options } from 'express-rate-limit';
import { PostgresRateLimitStore } from '../src/rate-limit';
import { prisma } from '../src/prisma';

afterAll(() => prisma.$disconnect());

test('two API replica stores share atomic limits and reset expired windows', async () => {
  const stores = [new PostgresRateLimitStore('replica-test'), new PostgresRateLimitStore('replica-test')];
  stores.forEach(store => store.init({ windowMs: 60_000 } as Options));
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => stores[i % 2].increment('user-a')));
  expect(results.map(result => result.totalHits).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  expect((await stores[0].increment('user-b')).totalHits).toBe(1);
  await prisma.rateLimitBucket.updateMany({ data: { resetTime: new Date(0) } });
  expect((await stores[1].increment('user-a')).totalHits).toBe(1);
});
