import { prisma } from './prisma';
import { buildReportDataset, type ReportKind } from './report-data';
import type { ReportPeriod } from './report-period';

export async function getReportDataset(tenantId: string, period: ReportPeriod, kind: ReportKind, customerId: string | null = null, state: string | null = null) {
  const [tenant, invoices, payments] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, nif: true } }),
    prisma.invoice.findMany({
      where: {
        tenantId, type: 'FT', status: 'ISSUED', issuedAt: { gte: period.start, lt: period.endExclusive },
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { issuedAt: 'asc' }, take: 5000,
      include: { customer: { select: { id: true, name: true } }, items: { select: { productId: true, description: true, quantity: true, total: true } }, payments: { select: { amount: true, status: true, paymentDate: true } } },
    }),
    kind === 'receipts' ? prisma.payment.findMany({
      where: { tenantId, paymentDate: { gte: period.start, lt: period.endExclusive }, ...(customerId ? { invoice: { customerId } } : {}), ...(state && ['PENDING', 'CONFIRMED', 'CANCELLED', 'REVERSED'].includes(state) ? { status: state } : {}) },
      orderBy: { paymentDate: 'asc' }, take: 10000,
      include: { invoice: { select: { number: true, customer: { select: { name: true } } } } },
    }) : Promise.resolve([]),
  ]);
  return buildReportDataset({ kind, company: { name: tenant?.name ?? '', nif: tenant?.nif ?? null }, period, customerId, state, invoices, payments });
}

export function parseReportKind(value: string | null | undefined): ReportKind {
  return value === 'receipts' || value === 'debt' || value === 'customers' || value === 'products' ? value : 'invoices';
}
