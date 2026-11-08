import { runWithTenant } from './tenant-db';
import { buildReportDataset, isStockReportKind, type AnyReportKind, type ReportDataset, type ReportKind } from './report-data';
import type { ReportPeriod } from './report-period';
import { isApplicationEnabled } from './platform-apps';
import { buildStockReportDataset, StockReportsUnavailableError } from './stock-report-service';

export async function getReportDataset(
  tenantId: string,
  period: ReportPeriod,
  kind: AnyReportKind,
  customerId: string | null = null,
  state: string | null = null,
  warehouseId: string | null = null,
  productId: string | null = null,
): Promise<ReportDataset> {
  if (isStockReportKind(kind)) {
    if (!(await isApplicationEnabled(tenantId, 'wms'))) throw new StockReportsUnavailableError();
    return buildStockReportDataset({ tenantId, kind, period, warehouseId, productId });
  }

  return runWithTenant(tenantId, async (tx) => {
    const [tenant, invoices, payments] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, nif: true } }),
      tx.invoice.findMany({
        where: {
          tenantId, type: 'FT', status: 'ISSUED', issuedAt: { gte: period.start, lt: period.endExclusive },
          ...(customerId ? { customerId } : {}),
        },
        orderBy: { issuedAt: 'asc' }, take: 5000,
        include: { customer: { select: { id: true, name: true } }, items: { select: { productId: true, description: true, quantity: true, total: true } }, payments: { select: { amount: true, status: true, paymentDate: true } } },
      }),
      kind === 'receipts' ? tx.payment.findMany({
        where: { tenantId, paymentDate: { gte: period.start, lt: period.endExclusive }, ...(customerId ? { invoice: { customerId } } : {}), ...(state && ['PENDING', 'CONFIRMED', 'CANCELLED', 'REVERSED'].includes(state) ? { status: state } : {}) },
        orderBy: { paymentDate: 'asc' }, take: 10000,
        include: { invoice: { select: { number: true, customer: { select: { name: true } } } } },
      }) : Promise.resolve([]),
    ]);
    return buildReportDataset({ kind: kind as ReportKind, company: { name: tenant?.name ?? '', nif: tenant?.nif ?? null }, period, customerId, state, invoices, payments });
  });
}

export function parseReportKind(value: string | null | undefined): AnyReportKind {
  const kinds: AnyReportKind[] = [
    'invoices', 'receipts', 'debt', 'customers', 'products',
    'stock_balances', 'stock_movements', 'stock_low', 'stock_transfers', 'stock_valuation',
  ];
  return kinds.includes(value as AnyReportKind) ? (value as AnyReportKind) : 'invoices';
}
