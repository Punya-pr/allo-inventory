import { PrismaClient } from '@prisma/client';

// Standard Next.js singleton pattern so we don't exhaust DB connections
// across hot-reloads in dev / per-lambda-invocation in serverless prod.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
