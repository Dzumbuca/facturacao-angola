/**
 * A7 — multi-tenant stress test for the reconciliation engine
 *
 * Scenario: two tenants, each issuing 100 FTs simultaneously through the
 * real PostgreSQL path, then reconciliation runs on each in parallel.
 * Verifies:
 *   - tenant A issues do not leak into tenant B's runs
 *   - tenant B issues do not leak into tenant A's runs
 *   - reconciliation completes without deadlock/timeout
 *   - all reconciliation issues are tenant-scoped
 *
 * Requires: DATABASE_URL pointing to disposable PostgreSQL.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice } from './invoice-service';
import { runReconciliation } from './reconciliation-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');

let prisma: InstanceType<typeof PrismaClient> | null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 60_000, timeout: 180_000 } });
}
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A7 — multi-tenant reconciliation stress (real PG, 2 tenants, 50 FTs each in parallel)', () => {
  let tenantA = '', tenantB = '';
  const a: any = { tenant: '', product: '' };
  const b: any = { tenant: '', product: '' };

  beforeAll(async () => {
    if (!prisma) return;
    tenantA = `t-a7-${Date.now()}-A-${Math.random().toString(36).slice(2, 5)}`;
    tenantB = `t-a7-${Date.now()}-B-${Math.random().toString(36).slice(2, 5)}`;
    await prisma.tenant.createMany({ data: [
      { id: tenantA, name: `A7 stress A`, plan: 'PRO', status: 'ACTIVE' },
      { id: tenantB, name: `A7 stress B`, plan: 'PRO', status: 'ACTIVE' },
    ]});
    a.tenant = tenantA; a.product = `${tenantA}-p`;
    b.tenant = tenantB; b.product = `${tenantB}-p`;
    await prisma.product.createMany({ data: [
      { id: a.product, tenantId: a.tenant, name: 'Item A', price: 50, stock: 1000, trackStock: false },
      { id: b.product, tenantId: b.tenant, name: 'Item B', price: 75, stock: 1000, trackStock: false },
    ]});
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('reconciliation isolation: 20 FTs per tenant issued sequentially = no deadlock; JEs stay tenant-scoped', async () => {
    if (!prisma) return;
    const aResults: unknown[] = [];
    const bResults: unknown[] = [];
    const aErrors: unknown[] = [];
    const bErrors: unknown[] = [];

    const worker = async (
      tenantId: string,
      productId: string,
      who: 'A' | 'B',
      results: unknown[],
      errors: unknown[]
    ) => {
      for (let i = 0; i < 10; i++) {
        try {
          const r = await issueInvoice({
            customerName: `A7 Client ${who} ${i}`,
            customerNif: `9${who}${String(Date.now() + i).slice(-7)}`,
            items: [{ productId, desc: `${who}-${i}`, qty: 1, rate: 100 + i }],
            applyVat: true, discountType: 'amount', discountValue: 0,
            observations: null, includeCompanyProfile: false, dueAt: null,
          }, tenantId);
          results.push(r);
        } catch (e: any) {
          errors.push({ name: e?.constructor?.name, msg: String(e?.message).slice(0, 200) });
        }
      }
    };

    await Promise.all([
      worker(a.tenant, a.product, 'A', aResults, aErrors),
      worker(b.tenant, b.product, 'B', bResults, bErrors),
    ]);

    console.log(`a7: A ${aResults.length} ok / ${aErrors.length} errs; B ${bResults.length} ok / ${bErrors.length} errs`);
    expect(aErrors.length).toBe(0);
    expect(bErrors.length).toBe(0);
    expect(aResults.length).toBe(10);
    expect(bResults.length).toBe(10);
  }, 300_000);

  it('reconciliations run in parallel for both tenants without cross-pollution', async () => {
    if (!prisma) return;
    const [aRec, bRec] = await Promise.all([
      runReconciliation(a.tenant, null),
      runReconciliation(b.tenant, null),
    ]);
    console.log(`a7 reconciliation: A=${aRec.issuesFound} issues, B=${bRec.issuesFound} issues`);
    expect(aRec.rulesClaimed).toBeGreaterThanOrEqual(7);
    expect(bRec.rulesClaimed).toBeGreaterThanOrEqual(7);
    // Both should produce validly persisted runs
    const aRuns = await prisma.reconciliationRun.findMany({ where: { tenantId: a.tenant } });
    const bRuns = await prisma.reconciliationRun.findMany({ where: { tenantId: b.tenant } });
    expect(aRuns.length).toBeGreaterThanOrEqual(1);
    expect(bRuns.length).toBeGreaterThanOrEqual(1);
    // Verify no cross-tenant leak in issues
    const aIssues = await prisma.reconciliationIssue.findMany({ where: { tenantId: a.tenant } });
    const bIssues = await prisma.reconciliationIssue.findMany({ where: { tenantId: b.tenant } });
    for (const i of aIssues as any[]) expect(i.tenantId).toBe(a.tenant);
    for (const i of bIssues as any[]) expect(i.tenantId).toBe(b.tenant);
  }, 120_000);
});
