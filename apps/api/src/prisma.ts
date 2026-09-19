import { PrismaClient } from '@prisma/client';

/** Share one connection pool across API routes. */
export const prisma = new PrismaClient();
