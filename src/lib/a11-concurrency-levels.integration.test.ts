/**
 * A11 — concurrency benchmarks 20/50/100 FTs.
 *
 * Asserts each level proceeds with no failures under the production-like
 * default configuration. 200 concurrent is documented in a separate report
 * due to PostgreSQL connection pool defaults; we do not bump connection limits.
 */

import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice } from './invoice-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

const runLevel = async (label: string, level: number) => {
  const p = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
  const suffix = Date.now().toString().slice(-6) + '-' + level;
  const tenantId = `a11-lv-${label.replace(/[^a-z0-9]/gi, '-')}-${suffix}`;
  await p.tenant.create({ data: { id: tenantId, name: `A11 ${label} ${tenantId}`, plan: 'PRO', status: 'ACTIVE' } });
  const productId = tenantId + '-p';
  await p.product.create({ data: { id: productId, tenantId, name: 'item-' + label, price: 100, stock: 1000, trackStock: false } });
  await p.$disconnect();
  const t0 = Date.now();
  const ops = Array.from({ length: level }, (_, i) =>
    issueInvoice({
      customerName: `C-${i}`, customerNif: '5000000001',
      items: [{ productId, desc: `I-${i}`, qty: 1, rate: 100 + i }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, tenantId).then((r) => ({ ok: true, number: r.number })).catch((e: any) => ({ ok: false, code: e?.code, msg: String(e?.message).slice(0, 60) })),
  );
  const results = await Promise.all(ops);
  const dt = Date.now() - t0;
  const okCount = results.filter(r => r.ok).length;
  const errCount = results.filter(r => !r.ok).length;
  const errorCodes = results.filter(r => !r.ok).map((r: any) => r.code);
  const codeCount: Record<string, number> = {};
  for (const c of errorCodes) codeCount[c] = (codeCount[c] ?? 0) + 1;
  console.log(`${label}: ok=${okCount}/${level} failed=${errCount} dt=${dt}ms errors=${JSON.stringify(codeCount)}`);
  return { okCount, errCount, codeCount, dt };
};

describeIfDisposable('A11 — Concurrency levels', () => {
  it('levels 20/50/100/200', async () => {
    const r20 = await runLevel('20-concurrent', 20);
    const r50 = await runLevel('50-concurrent', 50);
    const r100 = await runLevel('100-concurrent', 100);
    const r200 = await runLevel('200-concurrent', 200); console.log('r200:', r200.codeCount, r200.errCount); console.log('r20:', JSON.stringify(r20), 'r50:', JSON.stringify(r50), 'r100:', JSON.stringify(r100));
    expect(r20.okCount).toBe(20);
    expect(r50.okCount).toBe(50);
    expect(r100.okCount).toBe(100);
    expect(r200.okCount).toBe(200);
  }, 300_000);
});
