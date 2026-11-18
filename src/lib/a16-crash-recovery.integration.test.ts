import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice } from './invoice-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}

describeIfDisposable('A16 — crash recovery and lease consistency', () => {
  let tenantId = `a16-crash-${Date.now().toString().slice(-6)}`;

  beforeAll(async () => {
    if (!prisma) return;
    await prisma.tenant.create({ data: { id: tenantId, name: tenantId, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.product.create({ data: { id: tenantId + '-p', tenantId, name: 'item', price: 100, stock: 1000, trackStock: false } });
  });

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('process can complete around abandoned leases that expire naturally', async () => {
    if (!prisma) return;
    // Simulate an abandoned ACTIVE lease with expiresAt in the past
    await prisma.emissionLease.create({
      data: {
        tenantId,
        operationId: 'INVOICE',
        processId: `dead-sim-${Date.now()}`,
        state: 'ACTIVE',
        acquiredAt: new Date(Date.now() - 5 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1 * 60 * 1000),
        lastRenewedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });

    // Now issue FT — the new emission should reap the expired lease and acquire fine
    const r = await issueInvoice({
      customerName: 'Recovery Test', customerNif: '5000000001',
      items: [{ productId: tenantId + '-p', desc: 'recovery item', qty: 1, rate: 100 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, tenantId);

    expect(r.id).toBeDefined();
    // Verify no abandoned ACTIVE lease remains (reaping ran or lease was released)
    const abandonedCount = await prisma.emissionLease.count({
      where: { tenantId, state: 'ACTIVE', expiresAt: { lte: new Date() } },
    });
    expect(abandonedCount).toBe(0);
  }, 60_000);
});
