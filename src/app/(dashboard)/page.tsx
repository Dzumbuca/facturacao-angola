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
