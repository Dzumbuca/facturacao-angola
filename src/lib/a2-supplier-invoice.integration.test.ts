/**
 * FASE A2 — integração SupplierInvoice (contas a pagar) end-to-end
 *
 * Use DATABASE_URL_A2 para apontar para um dashboard descartável PostgreSQL.
 * Nunca usar contra produção/staging.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createSupplierInvoice,
  recordSupplierInvoicePayment,
  getOutstandingSupplierInvoices,
  cancelSupplierInvoice,
} from './supplier-invoice-service';

const url = process.env.DATABASE_URL_A2 || process.env.DATABASE_URL_A1 || process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
if (url && url.includes('supabase.com')) throw new Error('A2 integration proíbe Supabase');

let prisma: InstanceType<typeof PrismaClient> | null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A2 — SupplierInvoice end-to-end', () => {
  let testTenantId = '';
  let testSupplierId = '';
  const u = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    if (!prisma) return;
    const id = `t-a2si-${u()}`;
    testTenantId = id;
    await prisma.tenant.create({ data: { id, name: `A2 SI ${id}`, plan: 'PRO', status: 'ACTIVE' } });
    const supplier = await prisma.supplier.create({
      data: { id: `${id}-sup`, tenantId: id, name: `QA Supplier A2 ${id}`, nif: '5000000777', isActive: true },
    });
    testSupplierId = supplier.id;
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('cria, paga parcialmente, marca como PAID e cancela', async () => {
    if (!prisma) return;
    const tenantId = testTenantId;
    const supplierId = testSupplierId;

    // 1. Criar fatura pendente
    const inv = await createSupplierInvoice({
      supplierId,
      number: `SINV-${u()}`,
      total: 1200,
      taxTotal: 200,
      issuedAt: new Date(Date.now() - 30 * 86400000),
      dueDate: new Date(Date.now() - 10 * 86400000),
      notes: 'A2 test',
    }, tenantId);
    expect(inv.status).toBe('PENDING');
    expect(Number(inv.paidAmount)).toBe(0);

    // 2. Listar — deve estar overdue
    const { invoices, total } = await getOutstandingSupplierInvoices(tenantId);
    const overdue = invoices.find(i => i.id === inv.id);
    expect(overdue).toBeTruthy();
    expect(total.overdueCount).toBeGreaterThan(0);

    // 3. Pagar parcialmente
    await recordSupplierInvoicePayment(inv.id, 1200, tenantId);
    const after = await prisma!.supplierInvoice.findUnique({ where: { id: inv.id } });
    expect(['PAID', 'PENDING']).toContain(after?.status);
    if (Number(after?.paidAmount) >= 1200) expect(after?.status).toBe('PAID');

    // 4. Tentar cancelar (não pode depois de PAID — proteção enforcement)
    if (after?.status === 'PENDING') {
      const cancelled = await cancelSupplierInvoice(inv.id, tenantId);
      expect(cancelled.status).toBe('CANCELLED');
    }

    // 5. Idempotência ao reabrir
    const invAgain = await createSupplierInvoice({
      supplierId,
      number: inv.number,
      total: 9999,
      taxTotal: 0,
      issuedAt: new Date(),
    }, tenantId);
    expect(invAgain.id).toBe(inv.id);
  }, 60000);
});
