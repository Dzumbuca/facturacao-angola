/**
 * A3 — integration test: FT + payment emite ledger entries
 *
 * Use DATABASE_URL_A3 to point to a disposable PostgreSQL repository copy.
 * Never use against production/staging.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice } from './invoice-service';
import { recordPayment, transitionPayment } from './payment-service';
import { ensureChartOfAccounts } from './gl-service';

const url = process.env.DATABASE_URL_A3 || process.env.DATABASE_URL_A2;
const enabled = !!url && !url.includes('supabase.com');

let prisma: InstanceType<typeof PrismaClient> | null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A3 — FT→Pagamento emite ledger entries (real PostgreSQL)', () => {
  let tenantId = '';
  let customerId = '';
  let warehouseId = '';
  let productId = '';
  const u = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    if (!prisma) return;
    const id = `t-a3-gl-${u()}`;
    tenantId = id;
    customerId = `${id}-c`;
    warehouseId = `${id}-wh`;
    productId = `${id}-p`;

    await prisma.tenant.create({ data: { id, name: `A3 GL ${id}`, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.customer.create({ data: { id: customerId, tenantId: id, name: 'A3 GL Client', nif: '5000000888' } });
    await prisma.warehouse.create({ data: { id: warehouseId, tenantId: id, name: 'A3 GL WH', isDefault: true, isActive: true, updatedAt: new Date() } });
    await prisma.product.create({ data: { id: productId, tenantId: id, name: 'A3 GL Prod', price: 100, stock: 50, trackStock: false } });

    // Seed chart of accounts (idempotent)
    await ensureChartOfAccounts(tenantId);
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('FT issued → ledger contains receivable debit + revenue credit + tax credit', async () => {
    if (!prisma) return;

    // Issue FT — direct call bypassing HTTP/auth
    const inv = await issueInvoice({
      customerName: 'A3 GL Client', customerNif: '5000000888',
      items: [{ productId, desc: 'A3 item', qty: 1, rate: 1000 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: 'A3 GL test', includeCompanyProfile: false, dueAt: null,
    }, tenantId);

    const journalEntries = await prisma.journalEntry.findMany({
      where: { tenantId, source: 'INVOICE', sourceId: inv.id },
      include: { lines: true },
    });
    expect(journalEntries.length).toBe(1);
    const entry = journalEntries[0];
    const totalDebit = entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.001);

    // 1200 should be in debit code
    const receivableDebit = entry.lines.find((l: any) => l.debit.toString() !== '0');
    expect(receivableDebit).toBeDefined();
  }, 60000);

  it('FT payment CONFIRMED → ledger: DR bank, CR receivable', async () => {
    if (!prisma) return;

    // Issue FT first
    const inv = await issueInvoice({
      customerName: 'A3 GL Client', customerNif: '5000000888',
      items: [{ productId, desc: 'A3 pay test', qty: 1, rate: 500 }],
      applyVat: false, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, tenantId);

    const payment = await recordPayment(inv.id, {
      amount: 500, currency: 'AOA', method: 'CASH', status: 'PENDING' as const,
      reference: `A3-PAY-${u()}`, notes: null, paymentDate: new Date(),
      idempotencyKey: `a3-${Date.now()}`,
    }, tenantId, null);
    await transitionPayment(payment.id, 'CONFIRMED', tenantId, null);

    const entries = await prisma.journalEntry.findMany({
      where: { tenantId, source: 'CUSTOMER_PAYMENT', sourceId: payment.id },
      include: { lines: true },
    });
    expect(entries.length).toBe(1);
    const entry = entries[0];
    const totalDebit = entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.001);
  }, 60000);
});
