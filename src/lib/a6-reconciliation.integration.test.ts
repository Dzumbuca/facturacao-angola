/**
 * A6 — integration test: reconciliation engine
 *
 * Uses DATABASE_URL pointing to a disposable PG.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { runReconciliation } from './reconciliation-service';
import { issueInvoice } from './invoice-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');

let prisma: InstanceType<typeof PrismaClient> | null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A6 — Reconciliation engine', () => {
  let tenantId = '';
  let productId = '';
  let customerName = 'A6 Rec Customer';

  beforeAll(async () => {
    if (!prisma) return;
    tenantId = `t-a6-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.tenant.create({ data: { id: tenantId, name: `A6 Rec ${tenantId}`, plan: 'PRO', status: 'ACTIVE' } });
    productId = `${tenantId}-p`;
    await prisma.product.create({ data: { id: productId, tenantId, name: 'A6 Rec item', price: 100, stock: 50, trackStock: false } });
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('detects FT produced with GL → no issues for that FT after issuance', async () => {
    await issueInvoice(
      { customerName, customerNif: '5000000001', items: [{ productId, desc: 'A6 i', qty: 1, rate: 100 }], applyVat: false, discountType: 'amount', discountValue: 0, observations: null, includeCompanyProfile: false, dueAt: null },
      tenantId,
    );

    const r = await runReconciliation(tenantId, null);
    // After FT issuance + GL posting, there should be no FT_WITHOUT_JE issues
    const ftMissing = r.findings.filter((f) => f.issueType === 'FT_WITHOUT_JE');
    expect(ftMissing.length).toBe(0);
    expect(r.rulesClaimed).toBeGreaterThanOrEqual(7);
  }, 60000);

  it('re-running is idempotent: creates a new run row each time', async () => {
    const before = await prisma!.reconciliationRun.count({ where: { tenantId } });
    await runReconciliation(tenantId, null);
    await runReconciliation(tenantId, null);
    const after = await prisma!.reconciliationRun.count({ where: { tenantId } });
    expect(after - before).toBe(2);
  }, 60000);
});
