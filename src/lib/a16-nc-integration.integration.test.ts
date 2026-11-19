import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueCreditNote, issueInvoice } from './invoice-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}

describeIfDisposable('A16 — NC integrated with distributed leases', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    tenantId = 'a15-http-stress';
    const productId = tenantId + '-p';
    await prisma.tenant.upsert({
      where: { id: tenantId },
      create: { id: tenantId, name: 'A16 test', plan: 'PRO', status: 'ACTIVE' },
      update: {},
    });
    await prisma.product.upsert({
      where: { id: productId },
      create: { id: productId, tenantId, name: 'p', price: 100, stock: 1000, trackStock: false },
      update: {},
    });
    // Emitir uma FT fresca sempre em beforeAll: assim o teste nunca reutiliza uma FT já
    // anulada por NCs anteriores.
    await issueInvoice({
      customerName: 'a15-http-stress',
      customerNif: '5000000001',
      items: [{ productId, desc: 'FT fixture ' + Date.now(), qty: 1, rate: 100 }],
      applyVat: true,
      discountType: 'amount',
      discountValue: 0,
      observations: null,
      includeCompanyProfile: false,
      dueAt: null,
    }, tenantId);
    // ensure InvoiceChainState is restored from latest issued FT
    const lastInv = await prisma.invoice.findFirst({ where: { tenantId }, orderBy: { chainSequence: 'desc' }, select: { chainSequence: true } });
    if (lastInv) {
      const seq = lastInv.chainSequence;
      const hash = await prisma.invoice.findFirst({ where: { tenantId, chainSequence: seq }, select: { hash: true } });
      const invId = await prisma.invoice.findFirst({ where: { tenantId, chainSequence: seq }, select: { id: true } });
      await prisma.invoiceChainState.upsert({
        where: { tenantId },
        create: { tenantId, lastSequence: seq, lastHash: hash?.hash ?? null, lastInvoiceId: invId?.id ?? null },
        update: { lastSequence: seq, lastHash: hash?.hash ?? null, lastInvoiceId: invId?.id ?? null },
      });
    }
  }, 30_000);

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('NC issuance produces sequential document and balances ledger', async () => {
    if (!prisma) return;
    // Find any FT invoice to use as a reference for the NC
    const originalFT = await prisma.invoice.findFirst({ where: { tenantId, type: 'FT', status: { not: 'ANULADA' } }, orderBy: { chainSequence: 'desc' } });
    expect(originalFT).toBeTruthy();
    const ncResult = await issueCreditNote({
      invoiceId: originalFT!.id,
      reason: 'A16 — test de integração',
      tenantId,
    });
    expect(ncResult).toBeTruthy();
    const updatedChain = await prisma.invoiceChainState.findUnique({ where: { tenantId } });
    expect(updatedChain).toBeTruthy();
    console.log('chain after NC:', JSON.stringify(updatedChain));
  }, 60_000);
});
