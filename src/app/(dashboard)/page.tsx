import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getTenantPeriodMetrics } from '@/lib/financial-metrics';
import { parseReportPeriod, type ReportPeriodQuery } from '@/lib/report-period';
import { getInvoiceState } from '@/lib/invoice-state';
import { FinancialLineChart } from '@/components/financial-line-chart';

type Props = { searchParams: Promise<{ period?: string; from?: string; to?: string; metric?: string }> };
const money = (amount: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(amount);
const labels = { DRAFT: 'Rascunho', CANCELLED: 'Anulada', PAID: 'Paga', PARTIALLY_PAID: 'Parcial', OVERDUE: 'Vencida', ISSUED: 'Emitida' };
const methodNames: Record<string, string> = { BANK_TRANSFER: 'Transferência bancária', MULTICAIXA_EXPRESS: 'Multicaixa Express', MULTICAIXA_REFERENCE: 'Referência Multicaixa', CASH: 'Numerário', OTHER: 'Outro método' };
const stateColors: Record<string, string> = { ISSUED: '#748397', PARTIALLY_PAID: '#b16d15', PAID: '#248468', OVERDUE: '#bb4848' };

const periodOptions = [['today', 'Hoje'], ['last7days', '7 dias'], ['last30days', '30 dias'], ['thisMonth', 'Este mês'], ['lastMonth', 'Mês anterior'], ['thisQuarter', 'Trimestre'], ['thisYear', 'Este ano'], ['custom', 'Personalizado']];

export default async function DashboardPage({ searchParams }: Props) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');
  const query = await searchParams;
  const periodQuery: ReportPeriodQuery = { period: query.period ?? 'thisMonth', from: query.from, to: query.to };
  let period;
  try { period = parseReportPeriod(periodQuery); }
  catch { period = parseReportPeriod({ period: 'thisMonth' }); }
  const [tenant, metrics, totalCustomers, totalProducts, draftCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, legalName: true, nif: true, address: true, email: true, phone: true } }),
    getTenantPeriodMetrics(tenantId, period),
    prisma.customer.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.invoiceDraft.count({ where: { tenantId, status: 'DRAFT' } }),
  ]);
  if (!tenant) return <p>Empresa não configurada.</p>;

  const selectedMetric = query.metric === 'receipts' ? 'receipts' : 'invoices';
  const chart = selectedMetric === 'receipts' ? metrics.receiptSeries : metrics.invoiceSeries;
  const metricLabel = selectedMetric === 'receipts' ? 'Recebimentos confirmados' : 'Facturação emitida';
  const metricColor = selectedMetric === 'receipts' ? 'green' : 'blue';
  const chartHref = (metric: string) => {
    const params = new URLSearchParams({ period: period.key, metric });
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    return `/?${params.toString()}`;
  };
  const filterHref = (state: string) => `/invoices?state=${state}`;
  const profileIncomplete = !tenant.nif && !tenant.address && !tenant.email && !tenant.phone;
  const alerts = [
    metrics.overdue > 0 ? { title: `${money(metrics.overdue)} em saldo vencido`, href: '/invoices?state=OVERDUE', action: 'Ver facturas', tone: 'danger' } : null,
    metrics.dueSoon > 0 ? { title: `${money(metrics.dueSoon)} vence nos próximos 7 dias`, href: '/invoices', action: 'Ver facturas', tone: 'warning' } : null,
    draftCount ? { title: `${draftCount} rascunho${draftCount === 1 ? '' : 's'} por concluir`, href: '/invoices?tab=drafts', action: 'Continuar', tone: 'neutral' } : null,
    profileIncomplete ? { title: 'Complete o perfil da empresa para preencher documentos', href: '/empresa', action: 'Completar perfil', tone: 'neutral' } : null,
  ].filter(Boolean) as { title: string; href: string; action: string; tone: string }[];
  const stateRows = (['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as const).map((key) => ({ key, count: metrics.stateCounts[key], label: labels[key] }));
  const totalStates = Math.max(1, stateRows.reduce((sum, row) => sum + row.count, 0));
  const rangeLabel = `${new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Luanda' }).format(period.start)} — ${new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Luanda' }).format(new Date(period.endExclusive.getTime() - 1))}`;

  return <div className="space-y-8 pb-8">
    <section className="flex flex-col justify-between gap-5 border-b border-[#dce2e9] pb-6 lg:flex-row lg:items-end">
      <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#67768a]">{tenant.legalName || tenant.name}</p><h2 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-.035em] text-[#152236] md:text-[36px]">Resumo da actividade</h2><p className="mt-2 text-sm text-[#65758a]">Visão financeira · {rangeLabel}</p></div>
      <Link href="/invoices/new" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-md bg-[#021F87] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#061965] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#021F87] lg:self-auto"><span aria-hidden="true">＋</span> Emitir factura</Link>
    </section>

    <form action="/" method="get" className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(130px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)_auto]">
      <div><label className="app-label" htmlFor="period">Período</label><select id="period" name="period" defaultValue={query.period || 'thisMonth'} className="app-input">{periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="app-label" htmlFor="from">De</label><input id="from" name="from" type="date" defaultValue={query.from} className="app-input" /></div>
      <div><label className="app-label" htmlFor="to">Até</label><input id="to" name="to" type="date" defaultValue={query.to} className="app-input" /></div>
      <input type="hidden" name="metric" value={selectedMetric} />
      <button className="min-h-11 rounded-md border border-[#cbd3de] bg-white px-4 text-sm font-semibold text-[#344256] transition-colors hover:bg-[#f5f7fa]">Aplicar</button>
      <span className="col-span-2 text-xs text-[#7b8796] sm:col-span-4 sm:text-right">Datas no fuso Africa/Luanda · valores em AOA</span>
    </form>

    <section aria-label="Desempenho financeiro" className="grid gap-7 xl:grid-cols-[minmax(0,1.8fr)_minmax(250px,.72fr)]">
      <article className="min-w-0 border-y border-[#dce2e9] bg-white px-4 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#69788c]">Total facturado</p><p className="mt-3 tabular-nums text-[36px] font-semibold leading-none tracking-[-.045em] text-[#142238] sm:text-[44px]">{money(metrics.invoiced)}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {metrics.invoicedChangePercent === null ? <span className="text-[#778496]">Sem base para comparar com o período anterior</span> : <><span className={`font-bold ${metrics.invoicedChangePercent >= 0 ? 'text-[#227958]' : 'text-[#ad4444]'}`}>{metrics.invoicedChangePercent >= 0 ? '↑' : '↓'} {Math.abs(metrics.invoicedChangePercent).toLocaleString('pt-AO', { maximumFractionDigits: 1 })}%</span><span className="text-[#778496]">face ao período anterior · {money(metrics.invoicedPrevious)}</span></>}
          </div></div>
          <div className="flex w-fit rounded-md border border-[#e0e5eb] p-1" aria-label="Métrica do gráfico">
            <Link href={chartHref('invoices')} aria-current={selectedMetric === 'invoices' ? 'page' : undefined} className={`rounded px-3 py-2 text-xs font-semibold transition-colors ${selectedMetric === 'invoices' ? 'bg-[#021F87] text-white' : 'text-[#627187] hover:bg-[#f3f5f8]'}`}>Facturação</Link>
            <Link href={chartHref('receipts')} aria-current={selectedMetric === 'receipts' ? 'page' : undefined} className={`rounded px-3 py-2 text-xs font-semibold transition-colors ${selectedMetric === 'receipts' ? 'bg-[#021F87] text-white' : 'text-[#627187] hover:bg-[#f3f5f8]'}`}>Recebimentos</Link>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs text-[#68778a]"><span className={`h-2 w-2 rounded-full ${selectedMetric === 'receipts' ? 'bg-[#248468]' : 'bg-[#021F87]'}`} />{metricLabel}<span aria-hidden="true">·</span>{rangeLabel}</div>
        <div className="mt-3"><FinancialLineChart points={chart} label={metricLabel} color={metricColor} /></div>
      </article>

      <div className="flex flex-col divide-y divide-[#e5e9ef] border-y border-[#dce2e9] bg-white px-5 sm:px-6">
        <article className="py-5"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#69788c]">Recebido</p><p className="mt-2 tabular-nums text-[25px] font-semibold tracking-[-.03em] text-[#227958]">{money(metrics.received)}</p><p className="mt-1 text-xs text-[#788596]">Pagamentos confirmados no período</p></article>
        <article className="py-5"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#69788c]">Por receber</p><p className="mt-2 tabular-nums text-[25px] font-semibold tracking-[-.03em] text-[#26354a]">{money(metrics.outstanding)}</p><p className="mt-1 text-xs text-[#788596]">Saldo das facturas do período</p></article>
        <article className="py-5"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#69788c]">Em atraso</p><p className={`mt-2 tabular-nums text-[25px] font-semibold tracking-[-.03em] ${metrics.overdue > 0 ? 'text-[#ad4444]' : 'text-[#26354a]'}`}>{money(metrics.overdue)}</p><p className="mt-1 text-xs text-[#788596]">{metrics.dueSoon > 0 ? `${money(metrics.dueSoon)} vence nos próximos 7 dias` : 'Saldo com vencimento ultrapassado'}</p></article>
      </div>
    </section>

    <section className="grid gap-8 border-t border-[#dce2e9] pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <article>
        <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#69788c]">Carteira</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-[#19283d]">Situação dos documentos</h3></div><Link href="/invoices" className="text-xs font-semibold text-[#021F87] hover:underline">Ver facturas</Link></div>
        <div className="mt-5 space-y-4">{stateRows.map((row) => <Link key={row.key} href={filterHref(row.key)} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#021F87]">
          <span className="flex items-center gap-2 text-sm text-[#455469]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: stateColors[row.key] }} />{row.label}</span><span className="tabular-nums text-sm font-semibold text-[#26354a]">{row.count}</span>
          <span className="col-span-2 h-[5px] overflow-hidden rounded-sm bg-[#e9edf2]"><span className="block h-full rounded-sm transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(row.count ? 2 : 0, row.count / totalStates * 100)}%`, backgroundColor: stateColors[row.key] }} /></span>
        </Link>)}</div>
        <p className="mt-4 text-[11px] text-[#8490a0]">{metrics.invoiceCount} facturas emitidas no período seleccionado</p>
      </article>

      <article className="border-t border-[#dce2e9] pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
        <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#69788c]">Entradas de caixa</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-[#19283d]">Recebimentos por método</h3><p className="mt-1 text-xs text-[#788596]">Confirmados e pendentes, apresentados separadamente</p></div>
        {metrics.paymentMethods.length ? <div className="mt-5 space-y-4">{metrics.paymentMethods.map((method) => {
          const share = metrics.received > 0 ? method.confirmed / metrics.received * 100 : 0;
          return <div key={method.method}>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-medium text-[#3a4a5f]">{methodNames[method.method] ?? method.method}</span><span className="tabular-nums text-sm font-semibold text-[#227958]">{money(method.confirmed)}</span></div>
            <div className="mt-2 h-[5px] rounded-sm bg-[#e9edf2]"><div className="h-full rounded-sm bg-[#248468]" style={{ width: `${share}%` }} /></div>
            <div className="mt-1 flex justify-between text-[11px] text-[#7a8796]"><span>{share ? `${share.toLocaleString('pt-AO', { maximumFractionDigits: 1 })}% dos recebimentos confirmados` : 'Sem recebimentos confirmados'}</span>{method.pending > 0 && <span>Pendente: {money(method.pending)}</span>}</div>
          </div>;
        })}</div> : <div className="mt-5 border-l-2 border-[#cbd3de] py-2 pl-4"><p className="text-sm font-medium text-[#47576b]">Ainda sem recebimentos neste período</p><p className="mt-1 text-xs leading-5 text-[#7a8796]">Quando confirmar pagamentos, verá aqui os métodos e os respectivos valores. Pagamentos pendentes não contam como dinheiro recebido.</p></div>}
        {metrics.pendingTotal > 0 && <p className="mt-4 border-t border-[#e5e9ef] pt-3 text-xs text-[#7b6570]">Total pendente de confirmação: <strong className="tabular-nums">{money(metrics.pendingTotal)}</strong></p>}
      </article>
    </section>

    <section className="grid gap-8 border-t border-[#dce2e9] pt-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
      <article className="min-w-0">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#69788c]">Registo</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-[#19283d]">Actividade recente</h3></div><Link href="/invoices" className="text-xs font-semibold text-[#021F87] hover:underline">Todas as facturas</Link></div>
        {metrics.recentInvoices.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[590px] text-left text-sm"><thead><tr className="border-b border-[#dce2e9] text-[10px] font-bold uppercase tracking-[.12em] text-[#778496]"><th className="py-3 pr-4">Documento / cliente</th><th className="py-3 pr-4">Data</th><th className="py-3 pr-4 text-right">Valor</th><th className="py-3 text-right">Estado</th></tr></thead><tbody>{metrics.recentInvoices.map((invoice) => {
          const confirmed = invoice.payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + Number(payment.amount), 0);
          const state = getInvoiceState(invoice, confirmed);
          return <tr key={invoice.id} className="border-b border-[#edf0f4] last:border-0 hover:bg-[#f8f9fb]"><td className="py-3 pr-4"><Link href={`/invoices/${invoice.id}`} className="font-semibold text-[#26354a] hover:text-[#021F87] hover:underline">{invoice.number ?? invoice.id.slice(0, 8).toUpperCase()}</Link><span className="mt-1 block max-w-[240px] truncate text-xs text-[#798698]">{invoice.customer?.name ?? 'Adquirente'}</span></td><td className="py-3 pr-4 text-xs text-[#667589]">{new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Luanda' }).format(invoice.issuedAt)}</td><td className="py-3 pr-4 text-right tabular-nums font-semibold text-[#28374c]">{money(Number(invoice.total))}</td><td className="py-3 text-right"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state === 'OVERDUE' ? 'text-[#ad4444]' : state === 'PAID' ? 'text-[#227958]' : 'text-[#69788c]'}`}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stateColors[state] ?? '#748397' }} />{labels[state]}</span></td></tr>;
        })}</tbody></table></div> : <p className="mt-4 border-y border-[#e5e9ef] py-8 text-center text-sm text-[#778496]">Ainda não existem facturas neste período. <Link href="/invoices/new" className="font-semibold text-[#021F87] underline underline-offset-4">Emitir a primeira factura</Link></p>}
      </article>

      <aside className="border-t border-[#dce2e9] pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0" aria-labelledby="alerts-title">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#69788c]">Acompanhamento</p><h3 id="alerts-title" className="mt-1 text-lg font-semibold tracking-tight text-[#19283d]">Atenção necessária</h3>
        {alerts.length ? <ul className="mt-4 divide-y divide-[#e5e9ef]">{alerts.map((alert) => <li key={alert.title} className="flex items-start justify-between gap-3 py-3 first:pt-0"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.tone === 'danger' ? 'bg-[#bb4848]' : alert.tone === 'warning' ? 'bg-[#bd7b24]' : 'bg-[#9aa6b5]'}`} /><div className="min-w-0 flex-1"><p className="text-sm leading-5 text-[#38495e]">{alert.title}</p><Link href={alert.href} className="mt-1 inline-block text-xs font-semibold text-[#021F87] hover:underline">{alert.action}</Link></div></li>)}</ul> : <p className="mt-4 border-l-2 border-[#248468] py-2 pl-4 text-sm text-[#4f665f]">Sem situações a exigir atenção.</p>}
        <div className="mt-5 grid grid-cols-3 border-t border-[#e5e9ef] pt-4 text-center">
          <Link href="/customers" className="px-2 py-1 hover:bg-[#f5f7fa]"><span className="block text-[10px] text-[#7b8796]">Clientes</span><span className="mt-1 block tabular-nums text-base font-semibold text-[#26354a]">{totalCustomers}</span></Link>
          <Link href="/produtos" className="border-l border-[#e5e9ef] px-2 py-1 hover:bg-[#f5f7fa]"><span className="block text-[10px] text-[#7b8796]">Artigos</span><span className="mt-1 block tabular-nums text-base font-semibold text-[#26354a]">{totalProducts}</span></Link>
          <Link href="/invoices?tab=drafts" className="border-l border-[#e5e9ef] px-2 py-1 hover:bg-[#f5f7fa]"><span className="block text-[10px] text-[#7b8796]">Rascunhos</span><span className="mt-1 block tabular-nums text-base font-semibold text-[#26354a]">{draftCount}</span></Link>
        </div>
      </aside>
    </section>
  </div>;
}
