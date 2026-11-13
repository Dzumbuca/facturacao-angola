import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getTenantPeriodMetrics } from '@/lib/financial-metrics';
import { parseReportPeriod, type ReportPeriodQuery } from '@/lib/report-period';
import { getInvoiceState } from '@/lib/invoice-state';
import { FinancialLineChart } from '@/components/financial-line-chart';
import { PremiumHero, PremiumKpi } from '@/components/dashboard/premium-kit';
import { valueFontClass } from '@/lib/font-fit';

type Props = { searchParams: Promise<{ period?: string; from?: string; to?: string; metric?: string }> };
const money = (amount: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(amount);
const labels = { DRAFT: 'Rascunho', CANCELLED: 'Anulada', PAID: 'Paga', PARTIALLY_PAID: 'Parcial', OVERDUE: 'Vencida', ISSUED: 'Emitida' };
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
  const profileIncomplete = !tenant.nif && !tenant.address && !tenant.email && !tenant.phone;
  const alerts = [
    metrics.overdue > 0 ? { title: `${money(metrics.overdue)} em saldo vencido`, href: '/invoices?state=OVERDUE', action: 'Ver facturas', tone: 'danger' } : null,
    metrics.dueSoon > 0 ? { title: `${money(metrics.dueSoon)} vence nos próximos 7 dias`, href: '/invoices', action: 'Ver facturas', tone: 'warning' } : null,
    draftCount ? { title: `${draftCount} rascunho${draftCount === 1 ? '' : 's'} por concluir`, href: '/invoices?tab=drafts', action: 'Continuar', tone: 'neutral' } : null,
    profileIncomplete ? { title: 'Complete o perfil da empresa para preencher documentos', href: '/empresa', action: 'Completar perfil', tone: 'neutral' } : null,
  ].filter(Boolean) as { title: string; href: string; action: string; tone: string }[];
  const rangeLabel = `${new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Luanda' }).format(period.start)} — ${new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Luanda' }).format(new Date(period.endExclusive.getTime() - 1))}`;


  return <div className="dashboard-view space-y-7 pb-8">
    <PremiumHero>
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,.65fr)]">
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="kpi-pill">MACHINE FACTURAS</span>
            <span className="kpi-pill">{rangeLabel}</span>
          </div>
          <h1 className="text-3xl font-extrabold leading-[1.04] tracking-[-.035em] text-white sm:text-4xl xl:text-[46px]">Olá, {tenant.name}.</h1>
          <p className="max-w-prose text-lg font-semibold leading-snug text-[#dce7ff] sm:text-xl xl:text-2xl">Aqui está a saúde financeira da sua empresa.</p>
          <p className="max-w-prose text-sm leading-relaxed text-[#a9c4ff] sm:text-[15px]">Acompanhe a facturação, os recebimentos e os pagamentos pendentes da sua empresa, tudo num só lugar.</p>
          <div className="mt-1">
            <Link href="/invoices/new" className="inline-flex min-h-[52px] items-center gap-2 rounded-[16px] bg-white px-6 text-base font-extrabold text-[#041f52] shadow-[0_14px_34px_rgba(0,0,0,.22)] transition-transform transition-shadow hover:-translate-y-0.5 hover:bg-[#f3f6ff] hover:shadow-[0_18px_40px_rgba(0,0,0,.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[17px]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              Emitir factura
            </Link>
          </div>
        </div>

        <div aria-hidden="true" className="relative hidden h-full min-h-[180px] select-none items-center justify-center lg:flex">
          {/* Camada 1 — cartão maior */}
          <div className="absolute h-56 w-44 -rotate-[8deg] rounded-[20px] border border-white/10 bg-white/[0.04] backdrop-blur-[2px] shadow-[0_10px_30px_rgba(0,0,0,.25)]">
            <div className="flex h-full flex-col justify-between p-4">
              <div className="space-y-2"><div className="h-2 w-16 rounded-full bg-white/20" /><div className="h-2 w-10 rounded-full bg-white/15" /></div>
              <div className="space-y-2"><div className="h-2 w-12 rounded-full bg-white/15" /><div className="h-2 w-20 rounded-full bg-white/20" /></div>
            </div>
          </div>
          {/* Camada 2 — cartão intermédio */}
          <div className="absolute h-52 w-40 rotate-[4deg] rounded-[18px] border border-white/15 bg-white/[0.08] backdrop-blur-md shadow-[0_14px_36px_rgba(0,0,0,.32)]">
            <div className="flex h-full flex-col justify-between p-4">
              <div className="space-y-2"><div className="h-2 w-14 rounded-full bg-white/35" /><div className="h-2 w-20 rounded-full bg-white/25" /></div>
              <div className="space-y-2"><div className="h-2 w-16 rounded-full bg-white/30" /><div className="h-2 w-10 rounded-full bg-white/20" /></div>
            </div>
          </div>
          {/* Camada 3 — cartão frontal + ícone central */}
          <div className="relative flex h-56 w-44 items-center justify-center rounded-[22px] border border-white/25 bg-white/[0.14] backdrop-blur-xl shadow-[0_22px_50px_rgba(2,31,135,.45)]">
            <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#dce7ff] drop-shadow-[0_4px_12px_rgba(45,89,208,.45)]">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
            </svg>
          </div>
        </div>
      </div>
    </PremiumHero>

    <section aria-label="Acções rápidas" className="grid gap-3 sm:grid-cols-4">
      <Link href="/invoices/new" className="order-first col-span-2 flex items-center justify-between gap-4 rounded-[18px] border border-[#021f87]/25 bg-gradient-to-br from-[#021f87] to-[#0634b8] p-4 text-white shadow-[var(--shadow-cta)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-cta)] sm:col-span-2">
        <span><span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-[#b9d0ff]">Acção principal</span><span className="mt-1 block text-lg font-extrabold">Nova factura</span><span className="mt-1 block text-[11px] leading-4 text-[#b9d0ff]/90">Emita uma factura oficial em minutos</span></span>
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg></span>
      </Link>
      <Link href="/customers" className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[#021f87]/30">
        <span><span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--text-muted)]">Clientes</span><span className="mt-1 block text-sm font-bold">Novo cliente</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">Registre informações completas</span></span>
        <span className="tabular-nums text-lg font-extrabold text-[#021f87]">{totalCustomers}</span>
      </Link>
      <Link href="/produtos" className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[#021f87]/30">
        <span><span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--text-muted)]">Catálogo</span><span className="mt-1 block text-sm font-bold">Novo produto</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">Adicione produtos e serviços</span></span>
        <span className="tabular-nums text-lg font-extrabold text-[#021f87]">{totalProducts}</span>
      </Link>
      <Link href="/reports" className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[#021f87]/30">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-[#021f87]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16M4 15l6-6 4 4 6-8"/></svg></span>
        <span><span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--text-muted)]">Análise</span><span className="mt-1 block text-sm font-bold">Consultar relatórios</span></span>
      </Link>
    </section>

    <form action="/" method="get" className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(130px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)_auto]">
      <div><label className="app-label" htmlFor="period">Período</label><select id="period" name="period" defaultValue={query.period || 'thisMonth'} className="app-input">{periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="app-label" htmlFor="from">De</label><input id="from" name="from" type="date" defaultValue={query.from} className="app-input" /></div>
      <div><label className="app-label" htmlFor="to">Até</label><input id="to" name="to" type="date" defaultValue={query.to} className="app-input" /></div>
      <input type="hidden" name="metric" value={selectedMetric} />
      <button className="min-h-11 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-raised)]">Aplicar</button>
      <span className="col-span-2 text-xs text-[var(--text-muted)] sm:col-span-4 sm:text-right">Datas no fuso Africa/Luanda · valores em AOA</span>
    </form>

    <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <PremiumKpi
        label="Facturação do período"
        value={money(metrics.invoiced)}
        detail={metrics.invoicedChangePercent != null ? `${metrics.invoicedChangePercent >= 0 ? '↑' : '↓'} ${Math.abs(metrics.invoicedChangePercent).toFixed(1)}% vs ant. · ${money(metrics.invoicedPrevious)}` : 'Sem histórico de comparação'}
        tone="primary"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16"/><path d="M12 4v16"/></svg>}
      />
      <PremiumKpi
        label="Total recebido"
        value={money(metrics.received)}
        detail="Confirmados · entradas reais"
        tone="success"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>}
      />
      <PremiumKpi
        label="Por receber"
        value={money(metrics.pendingYetDue)}
        detail="Ainda não vencido · dentro do prazo"
        tone="warning"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
      />
      <PremiumKpi
        label="Em atraso"
        value={money(metrics.overdue)}
        detail={metrics.dueSoon > 0 ? `${money(metrics.dueSoon)} a vencer em 7 dias` : 'Saldo vencido pendente'}
        tone="danger"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>}
      />
    </section>

    <section aria-label="Análise financeira" className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,.72fr)]">
      <article className="dashboard-panel min-w-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[var(--text-muted)]">Evolução</p>
            <p className={`mt-2 tabular-nums font-semibold leading-none tracking-[-.035em] text-[var(--text)] ${valueFontClass(money(metrics.invoiced))}`}>{money(metrics.invoiced)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {metrics.invoicedChangePercent === null ? <span className="text-[var(--text-muted)]">Sem base para comparar</span> : <><span className={`font-bold ${metrics.invoicedChangePercent >= 0 ? 'text-[#227958]' : 'text-[#ad4444]'}`}>{metrics.invoicedChangePercent >= 0 ? '↑' : '↓'} {Math.abs(metrics.invoicedChangePercent).toLocaleString('pt-AO', { maximumFractionDigits: 1 })}%</span><span className="text-[var(--text-muted)]">face ao período anterior</span></>}
            </div>
          </div>
          <div className="flex w-fit rounded-[12px] border border-[var(--line)] p-1" aria-label="Métrica do gráfico">
            <Link href={chartHref('invoices')} aria-current={selectedMetric === 'invoices' ? 'page' : undefined} className={`rounded-[8px] px-3 py-2 text-xs font-semibold transition ${selectedMetric === 'invoices' ? 'bg-[#021f87] text-white shadow-[var(--shadow-card)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-raised)]'}`}>Facturação</Link>
            <Link href={chartHref('receipts')} aria-current={selectedMetric === 'receipts' ? 'page' : undefined} className={`rounded-[8px] px-3 py-2 text-xs font-semibold transition ${selectedMetric === 'receipts' ? 'bg-[#021f87] text-white shadow-[var(--shadow-card)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-raised)]'}`}>Recebimentos</Link>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-[var(--line)] pb-4 text-xs text-[var(--text-muted)]"><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${selectedMetric === 'receipts' ? 'bg-[#248468]' : 'bg-[#021f87]'}`} />{metricLabel}</span><span>·</span><span>{rangeLabel}</span></div>
        <div className="mt-4"><FinancialLineChart points={chart} label={metricLabel} color={metricColor} /></div>
      </article>

      <div className="dashboard-panel flex flex-col gap-4">
        <article><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Recebido</p><p className="mt-2 tabular-nums text-[26px] font-semibold tracking-[-.03em] text-[#227958]">{money(metrics.received)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Confirmados no período</p></article>
        <article className="border-t border-[var(--line)] pt-4"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Por receber</p><p className="mt-2 tabular-nums text-[26px] font-semibold tracking-[-.03em] text-[var(--text)]">{money(metrics.outstanding)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Saldo das facturas do período</p></article>
        <article className="border-t border-[var(--line)] pt-4"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Em atraso</p><p className={`mt-2 tabular-nums text-[26px] font-semibold tracking-[-.03em] ${metrics.overdue > 0 ? 'text-[#ad4444]' : 'text-[var(--text)]'}`}>{money(metrics.overdue)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{metrics.dueSoon > 0 ? `${money(metrics.dueSoon)} vence em 7 dias` : 'Saldo com vencimento ultrapassado'}</p></article>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
      <article className="dashboard-panel min-w-0 overflow-hidden">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Actividade</p><h3 className="mt-1 text-base font-semibold tracking-tight text-[var(--text)]">Actividade recente</h3></div><Link href="/invoices" className="text-xs font-semibold text-[#021f87] hover:underline">Ver todas →</Link></div>
        {metrics.recentInvoices.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[590px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]"><th className="py-3 pr-4">Documento / cliente</th><th className="py-3 pr-4">Data</th><th className="py-3 pr-4 text-right">Valor</th><th className="py-3 text-right">Estado</th></tr></thead><tbody>{metrics.recentInvoices.map((invoice) => {
          const confirmed = invoice.payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + Number(payment.amount), 0);
          const state = getInvoiceState(invoice, confirmed);
          return <tr key={invoice.id} className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-raised)]"><td className="py-3 pr-4"><Link href={`/invoices/${invoice.id}`} className="font-semibold text-[var(--text)] hover:text-[#021f87] hover:underline">{invoice.number ?? invoice.id.slice(0, 8).toUpperCase()}</Link><span className="mt-1 block max-w-[220px] truncate text-xs text-[var(--text-muted)]">{invoice.customer?.name ?? 'Adquirente'}</span></td><td className="py-3 pr-4 text-xs text-[var(--text-muted)]">{new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Luanda' }).format(invoice.issuedAt)}</td><td className="py-3 pr-4 text-right tabular-nums font-bold text-[var(--text)]">{money(Number(invoice.total))}</td><td className="py-3 text-right"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${state === 'OVERDUE' ? 'text-[#ad4444]' : state === 'PAID' ? 'text-[#227958]' : 'text-[var(--text-muted)]'}`}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stateColors[state] ?? '#748397' }} />{labels[state]}</span></td></tr>;
        })}</tbody></table></div> : <p className="mt-4 border-y border-[var(--line)] py-8 text-center text-sm text-[var(--text-muted)]">Sem facturas neste período. <Link href="/invoices/new" className="font-semibold text-[#021f87] underline underline-offset-4">Emitir a primeira factura</Link></p>}
      </article>

      <aside className="dashboard-panel flex flex-col justify-between" aria-labelledby="alerts-title">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Acompanhamento</p><h3 id="alerts-title" className="mt-1 text-base font-semibold tracking-tight text-[var(--text)]">Atenção necessária</h3>
          {alerts.length ? <ul className="mt-3 divide-y divide-[var(--line)]">{alerts.map((alert) => <li key={alert.title} className="flex items-start gap-3 py-3 first:pt-0"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.tone === 'danger' ? 'bg-[#bb4848]' : alert.tone === 'warning' ? 'bg-[#bd7b24]' : 'bg-[#9aa6b5]'}`} /><div className="min-w-0 flex-1"><p className="text-sm leading-5 text-[var(--text)]">{alert.title}</p><Link href={alert.href} className="mt-1 inline-block text-xs font-semibold text-[#021f87] hover:underline">{alert.action}</Link></div></li>)}</ul> : <p className="mt-3 rounded-lg border border-[#c7e5d1] bg-[#eff9f4] px-3 py-3 text-sm font-medium text-[#1e5e38]">Tudo certo — sem situações a exigir atenção.</p>}
        </div>
        <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--line)] rounded-[14px] border border-[var(--line)] bg-[var(--surface-raised)] text-center">
          <Link href="/customers" className="px-2 py-3 transition hover:bg-[var(--surface)]"><span className="block text-[10px] uppercase text-[var(--text-muted)]">Clientes</span><span className="mt-1 block tabular-nums text-base font-extrabold text-[var(--text)]">{totalCustomers}</span></Link>
          <Link href="/produtos" className="px-2 py-3 transition hover:bg-[var(--surface)]"><span className="block text-[10px] uppercase text-[var(--text-muted)]">Artigos</span><span className="mt-1 block tabular-nums text-base font-extrabold text-[var(--text)]">{totalProducts}</span></Link>
          <Link href="/invoices?tab=drafts" className="px-2 py-3 transition hover:bg-[var(--surface)]"><span className="block text-[10px] uppercase text-[var(--text-muted)]">Rascunhos</span><span className="mt-1 block tabular-nums text-base font-extrabold text-[var(--text)]">{draftCount}</span></Link>
        </div>
      </aside>
    </section>
  </div>;
}
