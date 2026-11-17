/**
 * A2 — supplier-invoice-service.ts
 *
 * Manages supplier invoices (contas a pagar). Lightweight — does not duplicate
 * the WMS stock module or the FT/NC engine. Designed to track payables.
 *
 * Lifecycle:
 *   PENDING → (payment confirmed) → PAID / OVERDUE
 *   PENDING → CANCELLED
 *
 * Does NOT write to StockMovement by default (those are goods-receipts). When
 * the PO itself was `ReceptionStatus === COMPLETE` for the matching products,
 * this service is independent.
 */

import { runWithTenant } from './tenant-db';
import { Prisma } from '@prisma/client';
import type { ReportPeriod } from './report-period';

export type SupplierInvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type SupplierInvoiceInput = {
  supplierId: string;
  number: string;
  total: number;
  taxTotal: number;
  issuedAt: Date;
  dueDate?: Date | null;
  purchaseOrderId?: string | null;
  notes?: string | null;
};

export type SupplierInvoiceRecordPaymentInput = {
  id: string;
  amount: number;
};

export type OutstandingPayable = {
  tenantId: string;
  count: number;
  totalOutstanding: number;
  overdueCount: number;
  overdueTotal: number;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type SupplierInvoiceRow = {
  id: string;
  tenantId: string;
  total: { toString(): string } | number;
  paidAmount: { toString(): string } | number;
  dueDate: Date | null;
  status: string;
  supplier?: { name: string };
};

export async function createSupplierInvoice(input: SupplierInvoiceInput, tenantId: string) {
  return runWithTenant(tenantId, async (tx) => {
    // Idempotency: if same number for same supplier already exists, return it
    const existing = await tx.supplierInvoice.findUnique({
      where: { tenantId_number: { tenantId, number: input.number } },
      include: { supplier: true },
    });
    if (existing) return existing;

    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
    if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');

    const total = round(input.total);
    const taxTotal = round(input.taxTotal);

    const created = await tx.supplierInvoice.create({
      data: {
        tenantId,
        number: input.number,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        total: new Prisma.Decimal(total.toFixed(2)),
        taxTotal: new Prisma.Decimal(taxTotal.toFixed(2)),
        paidAmount: new Prisma.Decimal(0),
        currency: 'AOA',
        issuedAt: input.issuedAt,
        dueDate: input.dueDate ?? null,
        status: 'PENDING',
        notes: input.notes ?? null,
      },
    });
    return created;
  });
}

export async function recordSupplierInvoicePayment(id: string, amount: number, tenantId: string, _actorId?: string | null) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');

  return runWithTenant(tenantId, async (tx) => {
    const invoice = await tx.supplierInvoice.findFirst({
      where: { id, tenantId },
    });
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND');
    if (invoice.status === 'CANCELLED') throw new Error('INVOICE_CANCELLED');
    if (invoice.status === 'PAID') return invoice;

    const newPaid = round(Number(invoice.paidAmount) + amount);
    const total = Number(invoice.total);
    const status: SupplierInvoiceStatus = newPaid >= total ? 'PAID' : 'PENDING';

    const updated = await tx.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
        status,
      },
    });
    return updated;
  });
}

export async function getOutstandingSupplierInvoices(tenantId: string, period?: ReportPeriod) {
  return runWithTenant(tenantId, async (tx) => {
    const now = new Date();
    const where: any = { tenantId, status: { in: ['PENDING', 'OVERDUE'] } };
    if (period) {
      where.issuedAt = { gte: period.start, lt: period.endExclusive };
    }
    const invoices = await tx.supplierInvoice.findMany({
      where,
      include: { supplier: true },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { issuedAt: 'asc' }],
    });

    const outstanding = invoices.reduce((sum: number, inv: any) => sum + Number(inv.total) - Number(inv.paidAmount), 0);
    const overdue = invoices.filter((inv: any) => inv.dueDate && inv.dueDate < now);
    const overdueTotal = overdue.reduce((sum: number, inv: any) => sum + Number(inv.total) - Number(inv.paidAmount), 0);

    let total: OutstandingPayable = {
      tenantId,
      count: invoices.length,
      totalOutstanding: round(outstanding),
      overdueCount: overdue.length,
      overdueTotal: round(overdueTotal),
    };
    return { invoices, total };
  });
}

export async function cancelSupplierInvoice(id: string, tenantId: string) {
  return runWithTenant(tenantId, async (tx) => {
    const invoice = await tx.supplierInvoice.findFirst({ where: { id, tenantId } });
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND');
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') throw new Error('INVOICE_FINAL');

    const updated = await tx.supplierInvoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELLED' },
    });
    return updated;
  });
}
