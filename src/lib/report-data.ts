import { getInvoicePaymentTotals } from './payment-rules';
import { getInvoiceState } from './invoice-state';
import type { ReportPeriod } from './report-period';

export type ReportKind = 'invoices' | 'receipts' | 'debt' | 'customers' | 'products';
export type ReportDataset = {
  kind: ReportKind; title: string; company: { name: string; nif: string | null };
  period: ReportPeriod; generatedAt: Date; filters: { customerId: string | null; state: string | null };
  headers: string[]; rows: (string | number | null)[][]; totals: (string | number | null)[];
};

export function buildReportRows(kind: ReportKind, input: { invoices: any[]; payments?: any[]; now: Date; state?: string | null }) {
  const invoices = input.invoices.filter((invoice) => {
    if (invoice.type !== 'FT' || invoice.status !== 'ISSUED') return false;
    if (!input.state) return true;
    const paid = invoice.payments.filter((payment: any) => payment.status === 'CONFIRMED').reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
    return getInvoiceState(invoice, paid, input.now) === input.state;
  });
  if (kind === 'invoices' || kind === 'debt') {
    const rows = invoices.flatMap((invoice) => {
      const confirmed = invoice.payments.filter((payment: any) => payment.status === 'CONFIRMED').reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
      const totals = getInvoicePaymentTotals(Number(invoice.total), [{ amount: confirmed, status: 'CONFIRMED' }]);
      if (kind === 'debt' && totals.outstanding <= 0) return [];
      const dueDays = invoice.dueAt ? dayDifference(localDateKey(input.now), localDateKey(invoice.dueAt)) : null;
      const ageing = dueDays === null || dueDays >= 0 ? 'No prazo' : dueDays >= -30 ? '1–30 dias' : dueDays >= -60 ? '31–60 dias' : dueDays >= -90 ? '61–90 dias' : 'Mais de 90 dias';
      const state = getInvoiceState(invoice, confirmed, input.now);
      if (kind === 'invoices') return [[invoice.number, invoice.customer.name, invoice.issuedAt.toLocaleDateString('pt-AO'), invoice.dueAt?.toLocaleDateString('pt-AO') ?? '', Number(invoice.total), totals.confirmed, totals.outstanding, state]];
      return [[invoice.number, invoice.customer.name, invoice.dueAt?.toLocaleDateString('pt-AO') ?? '', ageing, totals.outstanding, state]];
    });
    return { headers: kind === 'invoices' ? ['Documento', 'Cliente', 'Emissão', 'Vencimento', 'Total (AOA)', 'Recebido confirmado (AOA)', 'Em aberto (AOA)', 'Estado'] : ['Documento', 'Cliente', 'Vencimento', 'Antiguidade', 'Saldo (AOA)', 'Estado'], rows };
  }
  if (kind === 'receipts') {
    const rows = (input.payments ?? []).map((payment) => [payment.invoice.number, payment.invoice.customer.name, payment.paymentDate.toLocaleDateString('pt-AO'), payment.method, payment.status, Number(payment.amount), payment.reference ?? '']);
    return { headers: ['Documento', 'Cliente', 'Data', 'Método', 'Estado', 'Valor (AOA)', 'Referência'], rows };
  }
  if (kind === 'customers') {
    const grouped = new Map<string, { name: string; count: number; total: number; received: number }>();
    for (const invoice of invoices) {
      const row = grouped.get(invoice.customerId) ?? { name: invoice.customer.name, count: 0, total: 0, received: 0 };
      row.count++; row.total += Number(invoice.total);
      row.received += invoice.payments.filter((payment: any) => payment.status === 'CONFIRMED').reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
      grouped.set(invoice.customerId, row);
    }
    return { headers: ['Cliente', 'Facturas emitidas', 'Facturado no período (AOA)', 'Recebido (AOA)'], rows: [...grouped.values()].sort((a, b) => b.total - a.total).map((row) => [row.name, row.count, round(row.total), round(row.received)]) };
  }
  const products = new Map<string, { description: string; qty: number; total: number }>();
  for (const invoice of invoices) for (const item of invoice.items) {
    const id = item.productId ?? item.description;
    const row = products.get(id) ?? { description: item.description, qty: 0, total: 0 };
    row.qty += Number(item.quantity); row.total += Number(item.total); products.set(id, row);
  }
  return { headers: ['Artigo/serviço', 'Quantidade facturada', 'Facturado (AOA)'], rows: [...products.values()].sort((a, b) => b.total - a.total).map((row) => [row.description, round(row.qty), round(row.total)]) };
}

export function buildReportDataset(params: { kind: ReportKind; company: { name: string; nif: string | null }; period: ReportPeriod; customerId?: string | null; state?: string | null; invoices: any[]; payments?: any[]; now?: Date }): ReportDataset {
  const now = params.now ?? new Date();
  const { headers, rows } = buildReportRows(params.kind, { invoices: params.invoices, payments: params.payments, now, state: params.state });
  const title = ({ invoices: 'Relatório de facturação', receipts: 'Relatório de recebimentos', debt: 'Relatório de dívida e antiguidade', customers: 'Relatório de clientes', products: 'Relatório de artigos facturados' } satisfies Record<ReportKind, string>)[params.kind];
  const totals = headers.map((_, index) => {
    if (index === 0) return 'TOTAL';
    const sum = rows.reduce((total, row) => total + (typeof row[index] === 'number' ? row[index] as number : 0), 0);
    return sum || null;
  });
  return { kind: params.kind, title, company: params.company, period: params.period, generatedAt: now, filters: { customerId: params.customerId ?? null, state: params.state ?? null }, headers, rows, totals };
}

function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function localDateKey(date: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function dayDifference(from: string, to: string) { return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
