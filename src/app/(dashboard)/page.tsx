import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getTenantPeriodMetrics } from '@/lib/financial-metrics';
import { parseReportPeriod, type ReportPeriodQuery } from '@/lib/report-period';
import { EvolutionChartCard } from '@/components/dashboard/evolution-chart-card';
import { StackedMetricsCard } from '@/components/dashboard/stacked-metrics-card';
import { ActivityTable } from '@/components/dashboard/activity-table';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import { PremiumHero, PremiumKpi } from '@/components/dashboard/premium-kit';

type Props = { searchParams: Promise<{ period?: string; from?: string; to?: string; metric?: string }> };
const money = (amount: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(amount);

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

  const profileIncomplete = !tenant.nif && !tenant.address && !tenant.email && !tenant.phone;
  const alerts = [
    metrics.overdue > 0 ? { title: `${money(metrics.overdue)} em saldo vencido`, href: '/invoices?state=OVERDUE', action: 'Ver facturas', tone: 'danger' } : null,
    metrics.dueSoon > 0 ? { title: `${money(metrics.dueSoon)} vence nos próximos 7 dias`, href: '/invoices', action: 'Ver facturas', tone: 'warning' } : null,
    draftCount ? { title: `${draftCount} rascunho${draftCount === 1 ? '' : 's'} por concluir`, href: '/invoices?tab=drafts', action: 'Continuar', tone: 'neutral' } : null,
    profileIncomplete ? { title: 'Complete o perfil da empresa para preencher documentos', href: '/empresa', action: 'Completar perfil', tone: 'neutral' } : null,
  ].filter(Boolean) as { title: string; href: string; action: string; tone: string }[];
  const selectedMetric = query.metric === 'receipts' ? 'receipts' : 'invoices';
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

        <div aria-hidden="true" className="relative hidden h-full min-h-[210px] w-full max-w-[380px] select-none lg:block">
          {/* Elemento 1 — Mini gráfico financeiro */}
          <div className="hero-entrance absolute left-1 top-0" style={{ animationDelay: '120ms' }}>
            <div className="hero-float rounded-[16px] border border-white/15 bg-white/[0.10] p-3 shadow-[0_10px_24px_rgba(2,31,135,.45)] backdrop-blur-xl" style={{ animationDelay: '0s', transform: 'rotate(-2deg)' }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#b9d0ff]">EVOLUÇÃO</p>
              <svg width="132" height="56" viewBox="0 0 132 56" fill="none" className="mt-1.5">
                <defs>
                  <linearGradient id="mini-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a8c6ff" stopOpacity="0.55"/>
                    <stop offset="100%" stopColor="#a8c6ff" stopOpacity="0.02"/>
                  </linearGradient>
                </defs>
                <path d="M2 44 L22 38 L40 41 L58 30 L75 34 L94 22 L112 26 L130 12 L130 54 L2 54 Z" fill="url(#mini-grad)"/>
                <path d="M2 44 L22 38 L40 41 L58 30 L75 34 L94 22 L112 26 L130 12" stroke="#c8dbff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="130" cy="12" r="3" fill="#8ec0ff" stroke="#021f87" strokeWidth="1.6"/>
              </svg>
            </div>
          </div>

          {/* Elemento 2 — Cartão de Factura (elemento central) */}
          <div className="hero-entrance absolute left-[30px] top-[72px]" style={{ animationDelay: '280ms' }}>
            <div className="hero-float w-[188px] rounded-[18px] border border-white/25 bg-gradient-to-br from-[#0a2766]/90 to-[#021f87]/70 p-3 shadow-[0_22px_50px_rgba(2,31,135,.55)] backdrop-blur-xl" style={{ animationDelay: '1s', transform: 'rotate(6deg)' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/15">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dce7ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#aac4ff]">FACTURA</p>
                    <p className="text-[10px] font-semibold text-[#e8efff]">FT ····</p>
                  </div>
                </div>
                <span className="rounded-full border border-white/20 bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300">OK</span>
              </div>
              <div className="my-2.5 h-px bg-white/10" />
              <div className="space-y-1.5">
                <div className="h-[3px] w-full rounded-full bg-white/15" />
                <div className="h-[3px] w-4/5 rounded-full bg-white/15" />
                <div className="h-[3px] w-3/5 rounded-full bg-white/15" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[.12em] text-[#aac4ff]">Total</span>
                <span className="tabular-nums text-[13px] font-extrabold text-white">—</span>
              </div>
            </div>
          </div>

          {/* Elemento 3 — Indicador de Recebimentos */}
          <div className="hero-entrance absolute right-1 bottom-2" style={{ animationDelay: '440ms' }}>
            <div className="hero-float flex w-[140px] flex-col gap-2 rounded-[16px] border border-white/20 bg-white/[0.14] p-2.5 shadow-[0_12px_28px_rgba(2,31,135,.40)] backdrop-blur-xl" style={{ animationDelay: '2s', transform: 'rotate(-4deg)' }}>
              <div className="flex items-center gap-1.5">
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-400/25">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7ef0a1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M19 10l2 2-2 2"/><path d="M7 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/></svg>
                </div>
                <span className="text-[8px] font-extrabold uppercase tracking-[.14em] text-[#a0e4b5]">RECEBIMENTOS</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-lime-300"/>
              </div>
              <p className="text-[8px] text-[#c2d4ff]">entradas confirmadas</p>
            </div>
          </div>
        </div>
</div>
    </PremiumHero>

    <section aria-label="Atalhos" className="grid gap-3 sm:grid-cols-3">
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
      <div><label className="app-label" htmlFor="period">Período</label><select id="period" name="period" defaultValue={query.period || 'thisMonth'} className="ds-input">{periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="app-label" htmlFor="from">De</label><input id="from" name="from" type="date" defaultValue={query.from} className="ds-input" /></div>
      <div><label className="app-label" htmlFor="to">Até</label><input id="to" name="to" type="date" defaultValue={query.to} className="ds-input" /></div>
      <input type="hidden" name="metric" value={selectedMetric} />
      <button className="min-h-11 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-raised)]">Aplicar</button>
      <Link href="/?period=thisMonth" className="min-h-11 inline-flex items-center justify-center rounded-[12px] px-4 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]">Limpar</Link>
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

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.45fr)]">
      <EvolutionChartCard invoices={metrics.invoiceSeries} receipts={metrics.receiptSeries} periodStart={period.start.toISOString()} periodEnd={period.endExclusive.toISOString()} />
      <StackedMetricsCard received={metrics.received} pendingYetDue={metrics.pendingYetDue} overdue={metrics.overdue} />
    </section>
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
      <ActivityTable invoices={metrics.recentInvoices} />

      <AttentionPanel alerts={alerts} totalCustomers={totalCustomers} totalProducts={totalProducts} draftCount={draftCount} />
    </section>
  </div>;
}
