import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: any };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  // Pooler em modo transação: o maxWait padrão (2s) esgota sob concorrência.
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
