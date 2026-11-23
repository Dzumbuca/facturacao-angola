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

describeIfDisposable('A16 — multi-tenant isolation', () => {
  const suffix = Date.now().toString().slice(-6);
  const tenantA = `a16-iso-a-${suffix}`;
  const tenantB = `a16-iso-b-${suffix}`;

  beforeAll(async () => {
    if (!prisma) return;
    for (const tenantId of [tenantA, tenantB]) {
      await prisma.tenant.create({ data: { id: tenantId, name: `iso-${tenantId}`, plan: 'PRO', status: 'ACTIVE' } });
      await prisma.product.create({ data: { id: tenantId + '-p', tenantId, name: 'p', price: 100, stock: 1000, trackStock: false } });
    }
  });

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('Issue FT in two tenants concurrently without cross-tenant leakage', async () => {
    if (!prisma) return;
    const [a, b] = await Promise.all([
      issueInvoice({
        customerName: 'A', customerNif: '5000000001',
        items: [{ productId: tenantA + '-p', desc: 'p', qty: 1, rate: 100 }],
        applyVat: true, discountType: 'amount', discountValue: 0,
        observations: null, includeCompanyProfile: false, dueAt: null,
      }, tenantA),
      issueInvoice({
        customerName: 'B', customerNif: '5000000001',
        items: [{ productId: tenantB + '-p', desc: 'p', qty: 1, rate: 100 }],
        applyVat: true, discountType: 'amount', discountValue: 0,
        observations: null, includeCompanyProfile: false, dueAt: null,
      }, tenantB),
    ]);
    expect(a?.id).toBeDefined();
    expect(b?.id).toBeDefined();
    expect(a.id).not.toBe(b.id);
    // Confirm each invoice belongs to the right tenant
    const aInv = await prisma.invoice.findUnique({ where: { id: a.id }, select: { tenantId: true } });
    const bInv = await prisma.invoice.findUnique({ where: { id: b.id }, select: { tenantId: true } });
    expect(aInv?.tenantId).toBe(tenantA);
    expect(bInv?.tenantId).toBe(tenantB);
  }, 60_000);
});
