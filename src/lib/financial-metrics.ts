import { prisma } from './prisma';
import { getInvoiceState, type InvoiceDisplayState } from './invoice-state';
import type { ReportPeriod } from './report-period';

type MetricInvoice = { id: string; number?: string; type: string; status: string; total: number | string; issuedAt: Date; dueAt: Date | null; customer?: { name: string }; payments: { amount: number | string; status: string; paymentDate: Date; method?: string }[] };
type MetricPayment = { amount: number | string; status: string; paymentDate: Date; method?: string };
export type FinancialMetrics = {
  invoiced: number; invoicedPrevious: number; invoicedChangePercent: number | null; received: number; outstanding: number; overdue: number;
  dueSoon: number; invoiceCount: number; stateCounts: Record<InvoiceDisplayState, number>;
  invoiceSeries: { date: string; value: number }[]; receiptSeries: { date: string; value: number }[];
  paymentMethods: { method: string; confirmed: number; pending: number }[]; pendingTotal: number;
  recentInvoices: MetricInvoice[];
};

export function aggregatePeriodMetrics(input: { invoices: MetricInvoice[]; previousInvoices?: MetricInvoice[]; payments?: MetricPayment[]; period: ReportPeriod; now?: Date }): FinancialMetrics {
  const now = input.now ?? new Date();
  const invoices = input.invoices.filter((invoice) => invoice.type === 'FT' && invoice.status === 'ISSUED' && inRange(invoice.issuedAt, input.period));
  const payments = input.payments ?? input.invoices.flatMap((invoice) => invoice.payments);
  const validInvoices = input.invoices.filter((invoice) => invoice.type === 'FT' && invoice.status === 'ISSUED');
  const confirmedFor = new Map<string, number>();
  for (const invoice of validInvoices) confirmedFor.set(invoice.id, invoice.payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + Number(payment.amount), 0));
  const invoiced = roundMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0));
  const invoicedPrevious = roundMoney((input.previousInvoices ?? []).filter((invoice) => invoice.type === 'FT' && invoice.status === 'ISSUED').reduce((sum, invoice) => sum + Number(invoice.total), 0));
  const invoicedChangePercent = invoicedPrevious > 0 ? roundMoney((invoiced - invoicedPrevious) / invoicedPrevious * 100) : null;
  const periodPayments = payments.filter((payment) => inRange(payment.paymentDate, input.period));
  const received = roundMoney(periodPayments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + Number(payment.amount), 0));
  const methods = new Map<string, { method: string; confirmed: number; pending: number }>();
  for (const payment of periodPayments) {
    const method = payment.method || 'OTHER';
    const value = methods.get(method) ?? { method, confirmed: 0, pending: 0 };
    if (payment.status === 'CONFIRMED') value.confirmed += Number(payment.amount);
    if (payment.status === 'PENDING') value.pending += Number(payment.amount);
    methods.set(method, value);
  }
  const paymentMethods = [...methods.values()].map((method) => ({ ...method, confirmed: roundMoney(method.confirmed), pending: roundMoney(method.pending) })).sort((a, b) => b.confirmed - a.confirmed);
  let outstanding = 0;
  let overdue = 0;
  let dueSoon = 0;
  const stateCounts: Record<InvoiceDisplayState, number> = { DRAFT: 0, CANCELLED: 0, PAID: 0, PARTIALLY_PAID: 0, OVERDUE: 0, ISSUED: 0 };
  for (const invoice of invoices) {
    const confirmed = confirmedFor.get(invoice.id) ?? 0;
    const balance = Math.max(0, Number(invoice.total) - confirmed);
    const state = getInvoiceState(invoice, confirmed, now);
    stateCounts[state]++;
    outstanding += balance;
    if (state === 'OVERDUE') overdue += balance;
    if (balance > 0 && invoice.dueAt && dateKey(invoice.dueAt) >= dateKey(now) && dateKey(invoice.dueAt) <= dateKey(new Date(now.getTime() + 7 * 86400000))) dueSoon += balance;
  }
  return {
    invoiced, invoicedPrevious, invoicedChangePercent, received, outstanding: roundMoney(outstanding), overdue: roundMoney(overdue), dueSoon: roundMoney(dueSoon),
    paymentMethods, pendingTotal: roundMoney(paymentMethods.reduce((sum, method) => sum + method.pending, 0)),
    invoiceCount: invoices.length, stateCounts,
    invoiceSeries: series(invoices.map((invoice) => ({ date: invoice.issuedAt, value: Number(invoice.total) })), input.period),
    receiptSeries: series(payments.filter((payment) => payment.status === 'CONFIRMED' && inRange(payment.paymentDate, input.period)).map((payment) => ({ date: payment.paymentDate, value: Number(payment.amount) })), input.period),
    recentInvoices: [...invoices].sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime()).slice(0, 8),
  };
}

export async function getTenantPeriodMetrics(tenantId: string, period: ReportPeriod): Promise<FinancialMetrics> {
  const duration = period.endExclusive.getTime() - period.start.getTime();
  const previousPeriod = { ...period, key: 'previous', start: new Date(period.start.getTime() - duration), endExclusive: period.start };
  const [invoices, previousInvoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId, type: 'FT', status: 'ISSUED', issuedAt: { gte: period.start, lt: period.endExclusive } },
      orderBy: { issuedAt: 'desc' }, take: 1000,
      include: { customer: { select: { name: true } }, payments: { select: { amount: true, status: true, paymentDate: true, method: true } } },
    }),
    prisma.invoice.findMany({ where: { tenantId, type: 'FT', status: 'ISSUED', issuedAt: { gte: previousPeriod.start, lt: previousPeriod.endExclusive } }, select: { id: true, type: true, status: true, total: true, issuedAt: true, dueAt: true, payments: { select: { amount: true, status: true, paymentDate: true } } } }),
    prisma.payment.findMany({ where: { tenantId, status: { in: ['CONFIRMED', 'PENDING'] }, paymentDate: { gte: period.start, lt: period.endExclusive } }, select: { amount: true, status: true, paymentDate: true, method: true } }),
  ]);
  return aggregatePeriodMetrics({ invoices, previousInvoices, payments, period });
}

function inRange(date: Date, period: ReportPeriod) { return date >= period.start && date < period.endExclusive; }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function dateKey(date: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function series(rows: { date: Date; value: number }[], period: ReportPeriod) {
  const buckets = new Map<string, number>();
  const span = period.endExclusive.getTime() - period.start.getTime();
  const granularity = span > 220 * 86400000 ? 'month' : span > 45 * 86400000 ? 'week' : 'day';
  for (const row of rows) {
    let key = dateKey(row.date);
    if (granularity === 'month') key = key.slice(0, 7);
    if (granularity === 'week') {
      const localDay = Date.parse(`${key}T00:00:00Z`);
      const weekday = new Date(localDay).getUTCDay();
      key = new Date(localDay - ((weekday + 6) % 7) * 86400000).toISOString().slice(0, 10);
    }
    buckets.set(key, roundMoney((buckets.get(key) ?? 0) + row.value));
  }
  if (!buckets.size) return [];
  const first = Date.parse(`${dateKey(period.start)}T00:00:00Z`);
  const last = Date.parse(`${dateKey(new Date(period.endExclusive.getTime() - 1))}T00:00:00Z`);
  let cursor = first;
  if (granularity === 'week') cursor -= ((new Date(cursor).getUTCDay() + 6) % 7) * 86400000;
  if (granularity === 'month') cursor = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth(), 1);
  const filled: { date: string; value: number }[] = [];
  while (cursor <= last) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    const key = granularity === 'month' ? day.slice(0, 7) : day;
    filled.push({ date: key, value: buckets.get(key) ?? 0 });
    cursor = granularity === 'month' ? Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1) : cursor + (granularity === 'week' ? 7 : 1) * 86400000;
  }
  return filled;
}
