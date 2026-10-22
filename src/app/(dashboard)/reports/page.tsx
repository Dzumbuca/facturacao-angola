import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { parseReportPeriod } from '@/lib/report-period';
import { getReportDataset, parseReportKind } from '@/lib/report-service';
import { ReportBreakdownChart } from '@/components/report-breakdown-chart';

type Props = { searchParams: Promise<{ period?: string; from?: string; to?: string; kind?: string; customerId?: string; state?: string }> };

export default async function ReportsPage({ searchParams }: Props) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const query = await searchParams;
  const kind = parseReportKind(query.kind);
  let period;
  try { period = parseReportPeriod({ period: query.period ?? 'thisMonth', from: query.from, to: query.to }); }
  catch { period = parseReportPeriod({ period: 'thisMonth' }); }
  const [customers, dataset] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    getReportDataset(tenantId, period, kind, query.customerId || null, query.state || null),
  ]);
  const params = new URLSearchParams();
  params.set('kind', kind); params.set('period', query.period ?? 'thisMonth');
  if (query.from) params.set('from', query.from); if (query.to) params.set('to', query.to); if (query.customerId) params.set('customerId', query.customerId);
  if (query.state) params.set('state', query.state);
  const exportHref = (format: string) => `/api/reports/export?${new URLSearchParams([...params.entries(), ['format', format]]).toString()}`;
  const financialIndex = dataset.headers.findIndex((header) => /\(AOA\)/i.test(header) && /total|saldo|valor|facturado|recebido/i.test(header));
  const reportTotal = financialIndex >= 0 ? dataset.rows.reduce((sum, row) => sum + (typeof row[financialIndex] === 'number' ? row[financialIndex] as number : 0), 0) : null;
  const periodLabel = `${period.start.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })} — ${new Date(period.endExclusive.getTime() - 1).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}`;

  return <div className="space-y-8 pb-8">
    <header className="flex flex-col justify-between gap-5 border-b border-[#dce2e9] pb-6 lg:flex-row lg:items-end">
      <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#67768a]">Análise financeira</p><h2 className="mt-2 text-[30px] font-semibold tracking-[-.035em] text-[#152236] md:text-[36px]">Relatórios</h2><p className="mt-2 text-sm text-[#65758a]">{dataset.title} · {periodLabel}</p></div>
      <div className="flex flex-wrap gap-2">{(['pdf', 'xlsx', 'csv'] as const).map((format) => <a key={format} href={exportHref(format)} className="inline-flex min-h-10 items-center rounded-md border border-[#cbd3de] bg-white px-3 text-xs font-semibold uppercase tracking-wide text-[#344256] transition-colors hover:border-[#021F87] hover:text-[#021F87]">Descarregar {format}</a>)}</div>
    </header>

    <section className="grid gap-5 border-b border-[#dce2e9] pb-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-label="Resumo do relatório filtrado">
      <div><p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#6f7e91]">{financialIndex >= 0 ? dataset.headers[financialIndex] : 'Registos encontrados'}</p><p className="mt-2 tabular-nums text-3xl font-semibold tracking-[-.035em] text-[#18273c]">{reportTotal === null ? dataset.rows.length : new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(reportTotal)}</p></div>
      <p className="text-sm text-[#65758a]">{dataset.rows.length} {dataset.rows.length === 1 ? 'registo' : 'registos'} · filtros aplicados à tabela e aos ficheiros</p>
    </section>

    <form action="/reports" method="get" className="grid gap-3 border-y border-[#dce2e9] bg-white/60 py-5 sm:grid-cols-2 lg:grid-cols-6">
      <div><label htmlFor="report-kind" className="app-label">Relatório</label><select id="report-kind" name="kind" defaultValue={kind} className="app-input"><option value="invoices">Facturação</option><option value="receipts">Recebimentos</option><option value="debt">Dívida e antiguidade</option><option value="customers">Clientes</option><option value="products">Artigos facturados</option></select></div>
      <div><label htmlFor="report-period" className="app-label">Período</label><select id="report-period" name="period" defaultValue={query.period ?? 'thisMonth'} className="app-input"><option value="today">Hoje</option><option value="last7days">Últimos 7 dias</option><option value="last30days">Últimos 30 dias</option><option value="thisMonth">Este mês</option><option value="lastMonth">Mês anterior</option><option value="thisQuarter">Trimestre actual</option><option value="thisYear">Ano actual</option><option value="custom">Personalizado</option></select></div>
      <div><label htmlFor="report-from" className="app-label">De</label><input id="report-from" name="from" type="date" defaultValue={query.from} className="app-input" /></div>
      <div><label htmlFor="report-to" className="app-label">Até</label><input id="report-to" name="to" type="date" defaultValue={query.to} className="app-input" /></div>
      <div><label htmlFor="report-customer" className="app-label">Cliente</label><select id="report-customer" name="customerId" defaultValue={query.customerId ?? ''} className="app-input"><option value="">Todos</option>{customers.map((customer: { id: string; name: string }) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>
      <div><label htmlFor="report-state" className="app-label">Estado</label><select id="report-state" name="state" defaultValue={query.state ?? ''} className="app-input"><option value="">Todos</option>{(kind === 'receipts' ? [['PENDING', 'Pendente'], ['CONFIRMED', 'Confirmado'], ['CANCELLED', 'Cancelado'], ['REVERSED', 'Estornado']] : [['ISSUED', 'Emitida'], ['PARTIALLY_PAID', 'Parcialmente paga'], ['PAID', 'Paga'], ['OVERDUE', 'Vencida']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-6"><button className="min-h-10 rounded-md bg-[#021F87] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#061965]">Aplicar filtros</button><span className="text-xs text-[#708195]">Datas no fuso Africa/Luanda · valores em AOA</span></div>
    </form>

    <ReportBreakdownChart kind={dataset.kind} headers={dataset.headers} rows={dataset.rows} />

    <section className="min-w-0 border-t border-[#dce2e9] pt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718095]">Detalhe</p><h3 className="mt-1 text-base font-semibold text-[#1d2b40]">{dataset.title}</h3></div><p className="text-xs text-[#7a8796]">{dataset.company.name}{dataset.company.nif ? ` · NIF ${dataset.company.nif}` : ''}</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-[#dce2e9] text-[10px] uppercase tracking-[.1em] text-[#718095]"><tr>{dataset.headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-3">{header}</th>)}</tr></thead><tbody>{dataset.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-[#edf0f4] last:border-0 hover:bg-white">{row.map((cell, columnIndex) => <td key={columnIndex} className={`whitespace-nowrap px-3 py-3 ${typeof cell === 'number' ? 'text-right tabular-nums text-[#344358]' : 'text-[#4b5a6e]'}`}>{typeof cell === 'number' ? cell.toLocaleString('pt-AO', { maximumFractionDigits: 2 }) : cell ?? '—'}</td>)}</tr>)}</tbody>{dataset.rows.length > 0 && <tfoot className="border-t border-[#cfd7e1] font-bold text-[#26354a]"><tr>{dataset.totals.map((cell, index) => <td key={index} className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{typeof cell === 'number' ? cell.toLocaleString('pt-AO', { maximumFractionDigits: 2 }) : cell ?? '—'}</td>)}</tr></tfoot>}</table></div>
      {dataset.rows.length === 0 && <p className="border-y border-[#e2e7ed] py-8 text-center text-sm text-[#708195]">Sem dados para os filtros seleccionados. Os exports apresentam os cabeçalhos e o período escolhido.</p>}
    </section>
    <p className="text-xs text-[#708195]">Os recebimentos pendentes estão identificados e não contam como valores recebidos. Não há conversão de moeda nem cálculo de lucro.</p>
  </div>;
}
