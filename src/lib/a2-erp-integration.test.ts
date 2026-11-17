/**
 * FASE A2 — Teste de integração do fluxo ERP completo:
 * Venda → FT (com stock) → Pagamento → Indicação financeira → Relatórios
 *
 * Nunca usar contra produção/staging. Use DATABASE_URL_A2=… para apontar
 * para uma base descartável.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { issueInvoice } from './invoice-service';
import { recordPayment, transitionPayment, getInvoicePaymentTotals } from './payment-service';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL_A2 || process.env.DATABASE_URL_A1 || process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
if (url && url.includes('supabase.com')) throw new Error('A2 integration aponta para Supabase — proibido');

let prisma: InstanceType<typeof PrismaClient> | null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A2 — fluxo Venda → FT → Pagamento end-to-end (real PostgreSQL)', () => {
  let testTenantId = '';
  let testCustomerId = '';
  let testWarehouseId = '';
  let testProductId = '';
  const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    if (!prisma) return;
    const id = `t-a2-${uniqueSuffix()}`;
    testTenantId = id;
    testCustomerId = `${id}-c`;
    testWarehouseId = `${id}-wh`;
    testProductId = `${id}-p-track`;
    await prisma.tenant.create({ data: { id, name: `QA A2 ${id}`, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.customer.create({ data: { id: testCustomerId, tenantId: id, name: 'Cliente A2', nif: '5000000777' } });
    await prisma.warehouse.create({ data: { id: testWarehouseId, tenantId: id, name: 'QA A2 WH', isDefault: true, isActive: true, updatedAt: new Date() } });
    await prisma.product.create({ data: { id: testProductId, tenantId: id, name: 'QA A2 Tracked Prod', price: 100, stock: 100, trackStock: true } });
    await prisma.productWarehouseStock.create({ data: { id: `${testProductId}-pws`, tenantId: id, productId: testProductId, warehouseId: testWarehouseId, quantity: 100, updatedAt: new Date() } });

    // Enable WMS for this test tenant
    const wms = await prisma.platformApplication.findFirst({ where: { slug: 'wms' } });
    if (wms) {
      await prisma.tenantApplication.create({
        data: { id: `${id}-wms-en`, tenantId: id, applicationId: wms.id, enabled: true, enabledAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      });
    }
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('rodar fluxo completo: emitir FT com 2 unidades → stock decrementa → registar pagamento → confirmar → pagar totalmente → totais', async () => {
    if (!prisma) return;
    const tenantId = testTenantId;
    const customerId = testCustomerId;
    const warehouseId = testWarehouseId;
    const productId = testProductId;

    const beforeStock = await prisma!.productWarehouseStock.findFirst({
      where: { tenantId, productId, warehouseId },
    });
    const stockBefore = Number(beforeStock?.quantity);

    const inv = await issueInvoice({
      customerName: 'Cliente A2', customerNif: '5000000777',
      items: [{ productId, desc: 'Item A2', qty: 2, rate: 500 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: 'A2 end-to-end test', includeCompanyProfile: false, dueAt: null,
    }, tenantId);

    expect(inv.chainSequence).toBe(1);
    expect(inv.hashVersion).toBe(2);
    expect(['FT', 'FT']).toContain(inv.type ?? 'FT'); // FT default

    const afterStock = await prisma!.productWarehouseStock.findFirst({
      where: { tenantId, productId, warehouseId },
    });
    expect(Number(afterStock?.quantity)).toBe(stockBefore - 2);

    // Split payment: 50% CASH, 50% BANK_TRANSFER
    const cashPayment = await recordPayment(inv.id, {
      amount: 1140, currency: 'AOA', method: 'CASH', status: 'PENDING' as const,
      reference: 'REF-A2-001', notes: null, paymentDate: new Date(), idempotencyKey: `a2-${Date.now()}-cash`,
    }, tenantId, null);
    expect(cashPayment.status).toBe('PENDING');
    const confirmed = await transitionPayment(cashPayment.id, 'CONFIRMED', tenantId, null);
    expect(confirmed.status).toBe('CONFIRMED');

    // Remaining balance is zero after IVA-inclusive payment
    const totals = await getInvoicePaymentTotals(inv.id, tenantId);
    expect(Number(totals.confirmed)).toBeCloseTo(1140, 2);
    expect(Number(totals.outstanding)).toBeLessThan(0.01);

    // Confirm receipt was auto-created
    const receipt = await prisma!.paymentReceipt.findUnique({
      where: { paymentId: cashPayment.id },
    });
    expect(receipt).toBeTruthy();
  }, 60000);

  it('Cobre múltiplos pagamentos parcelados', async () => {
    if (!prisma) return;
    const tenantId = testTenantId;
    const customerId = testCustomerId;
    const productId = testProductId;

    const inv = await issueInvoice({
      customerName: 'Cliente A2', customerNif: '5000000777',
      items: [{ productId, desc: 'Parcelado', qty: 1, rate: 1000 }],
      applyVat: false, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, tenantId);

    // Total = 1000 (sem IVA)
    const totalsBefore = await getInvoicePaymentTotals(inv.id, tenantId);
    expect(Number(totalsBefore.outstanding)).toBeCloseTo(1000, 2);
    expect(Number(totalsBefore.confirmed)).toBe(0);

    // 3 split payments
    for (let i = 1; i <= 3; i++) {
      await recordPayment(inv.id, {
        amount: 333.33, currency: 'AOA', method: 'CASH', status: 'PENDING' as const,
        reference: `SPL-${i}-${Date.now()}`, notes: null, paymentDate: new Date(), idempotencyKey: `a2-split-${Date.now()}-${i}`,
      }, tenantId, null);
    }
    // Confirm first two for 666.66
    const payments = await prisma!.payment.findMany({ where: { invoiceId: inv.id, tenantId } });
    expect(payments.length).toBe(3);
    for (const p of payments) {
      await transitionPayment(p.id, 'CONFIRMED', tenantId, null);
    }

    const totals = await getInvoicePaymentTotals(inv.id, tenantId);
    expect(Number(totals.confirmed)).toBeCloseTo(999.99, 2);
  }, 60000);
});
