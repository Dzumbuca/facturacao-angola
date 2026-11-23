import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } } });
}

describeIfDisposable('A13 — lease raw', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    tenantId = `a13-raw-${Date.now()}`;
    await prisma.tenant.create({ data: { id: tenantId, name: tenantId, plan: 'PRO', status: 'ACTIVE' } });
  });

  it('count returns 1 after one ACTIVE lease', async () => {
    if (!prisma) return;
    // Manually create one active lease
    const t = new Date(Date.now() + 60_000);
    await prisma.emissionLease.create({
      data: {
        tenantId,
        operationId: 'TEST',
        processId: 'p',
        state: 'ACTIVE',
        acquiredAt: new Date(),
        expiresAt: t,
        lastRenewedAt: new Date(),
      },
    });
    const count = await prisma.emissionLease.count({
      where: { tenantId, state: 'ACTIVE', expiresAt: { gt: new Date() } },
    });
    expect(count).toBe(1);
  });
});
