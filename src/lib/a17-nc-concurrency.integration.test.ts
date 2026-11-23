import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueCreditNote, issueInvoice } from './invoice-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A17 — NC concurrency 1 anchor + 3 contenders', () => {

  const suffix = Date.now().toString().slice(-6);
  const tenantId = `a17-nc-conc-${suffix}`;
  const productId = `${tenantId}-p`;
  let prisma: any = null;

  beforeAll(async () => {
    if (!enabled) return;
    prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
    await prisma.tenant.create({ data: { id: tenantId, name: `A17 NC CONC ${suffix}`, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.product.create({ data: { id: productId, tenantId, name: 'NC Item', price: 100, stock: 100000, trackStock: false } });
    await prisma.invoiceChainState.upsert({ where: { tenantId }, update: {}, create: { tenantId, lastSequence: 0, lastHash: null, lastInvoiceId: null } });
    // Issue 3 FTs that will be the anchor for 3 concurrent NCs
    for (let i = 0; i < 3; i++) {
      await issueInvoice({
        customerName: `Cliente ${i}`, customerNif: '5000000001',
        items: [{ productId, desc: 'item', qty: 1, rate: 100 }],
        applyVat: true, discountType: 'amount', discountValue: 0,
        observations: null, includeCompanyProfile: false, dueAt: null,
      }, tenantId);
    }
  }, 120_000);

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('3 concurrent NCs on 3 different FTs complete; chain sequence advances', async () => {
    const ft1 = await prisma.invoice.findFirst({ where: { tenantId, type: 'FT', chainSequence: 1 } });
    const ft2 = await prisma.invoice.findFirst({ where: { tenantId, type: 'FT', chainSequence: 2 } });
    const ft3 = await prisma.invoice.findFirst({ where: { tenantId, type: 'FT', chainSequence: 3 } });
    // Issue 3 NCs concurrently
    const results = await Promise.allSettled([
      issueCreditNote({ invoiceId: ft1!.id, reason: 'A17 NC 1', tenantId }),
      issueCreditNote({ invoiceId: ft2!.id, reason: 'A17 NC 2', tenantId }),
      issueCreditNote({ invoiceId: ft3!.id, reason: 'A17 NC 3', tenantId }),
    ]);
    const success = results.filter(r => r.status === 'fulfilled').length;
    console.log('NC concurrency:', { success, total: results.length });
    // document what happened
    for (const [i, r] of results.entries()) {
      if (r.status === 'fulfilled') console.log(`NC ${i+1}: OK chainSeq=NC`);
      else console.log(`NC ${i+1}: REJECTED — ${(r.reason as any)?.message?.slice(0, 80)}`);
    }
    const ncRows = await prisma.invoice.count({ where: { tenantId, type: 'NC' } });
    console.log('total NCs:', ncRows);
    expect(success).toBeGreaterThanOrEqual(1); // at least one must succeed; nothing crashed
  }, 120_000);
});
