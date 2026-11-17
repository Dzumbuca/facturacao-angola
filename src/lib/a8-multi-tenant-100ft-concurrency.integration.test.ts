import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice } from './invoice-service';

const url = process.env.DATABASE_URL;
const describeIfDisposable = url ? describe : describe.skip;

describeIfDisposable('A8 — same tenant 100 FTs parallel (advisory lock removed, row-lock chain)', () => {
  it('does not deadlock; 100 out of 100 FTs issued successfully', async () => {
    const p = new PrismaClient({ datasources: { db: { url } } });
    const tenantId = 'a8-stress-' + Date.now();
    await p.tenant.create({ data: { id: tenantId, name: tenantId, plan: 'PRO', status: 'ACTIVE' } });
    const productId = tenantId + '-p';
    await p.product.create({ data: { id: productId, tenantId, name: 'item', price: 100, stock: 1000, trackStock: false } });
    await p.$disconnect();
    const results: any[] = [];
    const errors: any[] = [];
    const ops = Array.from({ length: 100 }, (_, i) =>
      issueInvoice({
        customerName: `c${i}`, customerNif: '5000000001',
        items: [{ productId, desc: `x${i}`, qty: 1, rate: 100 + i }],
        applyVat: true, discountType: 'amount', discountValue: 0,
        observations: null, includeCompanyProfile: false, dueAt: null,
      }, tenantId).then((r) => results.push(r)).catch((e) => errors.push({ msg: e?.message?.slice(0, 200), code: e?.code })),
    );
    await Promise.all(ops);
    console.log('ok:', results.length, 'errors:', errors.length, JSON.stringify(errors).slice(0, 400));
    expect(errors.length).toBe(0);
    expect(results.length).toBe(100);
  }, 300_000);
});
