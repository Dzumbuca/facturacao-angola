'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdHtml } from '@/components/ad-html';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavIcon } from '@/components/nav-icons';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { ResponsiveTables } from '@/components/responsive-tables';
import { PwaInstall } from '@/components/pwa-install';
import { visibleNavGroups } from '@/lib/navigation';
import { GlobalSearch } from '@/components/global-search';
import { NotificationsBell } from '@/components/notifications-bell';
import { ShellAside, ShellTopbar, ShellMain } from '@/components/system/shell';

type NavLink = { href: string; label: string; icon: string };
const groups: { title: string; links: NavLink[] }[] = [
  { title: 'Principal', links: [{ href: '/', label: 'Dashboard', icon: 'layout' }, { href: '/apps', label: 'Aplicações', icon: 'puzzle' }] },
  { title: 'Documentos', links: [{ href: '/invoices', label: 'Facturas', icon: 'file' }, { href: '/documentos', label: 'Documentos', icon: 'receipt' }, { href: '/customers', label: 'Clientes', icon: 'users' }, { href: '/produtos', label: 'Produtos', icon: 'package' }] },
  { title: 'Ferramentas', links: [{ href: '/ferramentas', label: 'Centro de ferramentas', icon: 'calculator' }] },
  { title: 'Operações', links: [{ href: '/warehouses', label: 'Armazéns', icon: 'building' }] },
  { title: 'Análise', links: [{ href: '/reports', label: 'Relatórios', icon: 'chart' }] },
  { title: 'Empresa', links: [{ href: '/empresa', label: 'Perfil da empresa', icon: 'building' }] },
];
const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/apps': 'Aplicações',
  '/invoices': 'Facturas',
  '/invoices/new': 'Emitir fatura',
  '/ferramentas': 'Centro de ferramentas',
  '/documentos': 'Documentos Empresariais',
  '/reports': 'Relatórios',
  '/customers': 'Clientes',
  '/produtos': 'Produtos',
  '/empresa': 'Dados da empresa',
};

export function AppShell({ children, platformAdmin = false, plan = 'FREE', adHtml = null, planDaysLeft = null, planExpired = false, wmsEnabled = false }: { children: ReactNode; platformAdmin?: boolean; plan?: string; adHtml?: string | null; planDaysLeft?: number | null; planExpired?: boolean; wmsEnabled?: boolean }) {
  const pathname = usePathname();
  const title = titles[pathname] ?? 'Facturação Angola';
  const visibleGroups = visibleNavGroups(groups, wmsEnabled);

  return (
    <div className="min-h-dvh">
      <ShellAside tone="navy" width="w-[76px] lg:w-[248px]" className="group px-2 py-3 transition-[width] duration-200 lg:px-4 lg:py-5">
        <Link href="/" className="mb-4 flex shrink-0 items-center gap-3 rounded-xl px-2 py-1" aria-label="Machine Facturas, início">
          <img src="/logo.png" width="800" height="600" alt="Facturação" className="h-9 w-auto max-w-[44px] rounded-lg bg-white object-contain px-1 py-1 md:max-w-[52px] lg:max-w-[92px]" />
          <span className="hidden leading-tight lg:block"><strong className="block text-[13px] tracking-[.12em]">MACHINE FACTURAS</strong><span className="text-[9px] uppercase tracking-[.1em] text-slate-400">Gestão financeira</span></span>
        </Link>
        <nav aria-label="Navegação principal" className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain py-1 sidebar-scroll">
          {visibleGroups.map((group) => <section key={group.title} aria-label={group.title}>
            <h2 className="mb-1 hidden lg:block px-3 text-[9px] font-extrabold uppercase tracking-[.16em] text-slate-500">{group.title}</h2>
            <ul className="space-y-0.5">{group.links.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
              return <li key={href}><Link href={href} aria-current={active ? 'page' : undefined} className={`relative flex items-center justify-center gap-0 rounded-xl px-2 py-2.5 text-[13px] font-medium transition-all lg:justify-start lg:gap-3 lg:px-3 lg:py-2 ${active ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-[#7795ff] before:to-[#2878d0]' : 'text-slate-300 hover:bg-white/[.07] hover:text-white'}`}><NavIcon name={icon} /><span className="hidden lg:inline">{label}</span></Link></li>;
            })}</ul>
          </section>)}
          {platformAdmin && <section aria-label="Plataforma">
            <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Plataforma</h2>
            <ul className="space-y-0.5"><li><Link href="/admin" aria-current={pathname === '/admin' || pathname.startsWith('/admin/') ? 'page' : undefined} className={`relative flex items-center justify-center gap-0 rounded-xl px-2 py-2.5 text-[13px] font-medium transition-all lg:justify-start lg:gap-3 lg:px-3 lg:py-2 ${pathname === '/admin' || pathname.startsWith('/admin/') ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-[#7795ff] before:to-[#2878d0]' : 'text-slate-300 hover:bg-white/[.07] hover:text-white'}`}><NavIcon name="building" /><span className="hidden lg:inline">Administração da plataforma</span></Link></li></ul>
          </section>}
        </nav>
        <div className="mt-2 shrink-0 space-y-3 border-t border-white/10 px-2 pt-3 hidden md:block lg:px-3">
          <div>
            <p className="text-[10px] uppercase tracking-[.12em] text-slate-500">Moeda da conta</p>
            <p className="mt-1 text-xs font-medium text-slate-300">Kwanza · AOA</p>
            <p className="mt-2 text-[10px] uppercase tracking-[.12em] text-slate-500">Plano</p>
            <p className="mt-1 text-xs font-medium text-slate-300">{planExpired ? 'Pro expirou' : plan === 'PRO' ? 'Pro' : 'Grátis'}</p>
          </div>
          {planExpired && <Link href="/pagamento" className="block rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20">Plano expirou — Renovar →</Link>}
          {plan === 'PRO' && planDaysLeft !== null && planDaysLeft <= 14 && <Link href="/pagamento" className="block rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20">Expira em {planDaysLeft} {planDaysLeft === 1 ? 'dia' : 'dias'} — Renovar →</Link>}
          {plan !== 'PRO' && <div>
            <p className="text-[10px] uppercase tracking-[.12em] text-slate-500">Anúncio</p>
            {adHtml && <div className="mt-2 overflow-hidden rounded-lg bg-white p-2 text-[#1c2d3f]"><AdHtml html={adHtml} /></div>}
            <div className="mt-2 overflow-hidden rounded-lg bg-gradient-to-br from-[#2878d0] to-[#102b46] p-3 text-white">
              <p className="text-xs font-bold">Pacotes pagos</p>
              <p className="mt-1 text-[11px] leading-4 text-blue-100">Sem anúncios, stock, relatórios e equipa. Básico desde 5.000 Kz/mês.</p>
              <Link href="/pagamento" className="mt-2 inline-flex rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#102b46] transition hover:bg-blue-50">Ver pacotes</Link>
            </div>
          </div>}
        </div>
      </ShellAside>

      <div className="min-w-0 md:ml-[76px] lg:ml-[248px]">
        <ShellTopbar
          tone="navy"
          eyebrow="Facturação Angola"
          title={title}
          brand={<img src="/logo.png" width="800" height="600" alt="Facturação" className="h-7 w-auto max-w-[64px] shrink-0 rounded-md bg-white object-contain px-1 py-0.5 md:hidden" />}
          right={<div className="flex shrink-0 items-center gap-1.5 sm:gap-2"><NotificationsBell /><ThemeToggle compact /></div>}
        />
        <div className="border-b border-[#eef2f7] bg-[#f8fafc]/80 px-4 py-2 backdrop-blur-md md:hidden">
          <GlobalSearch />
        </div>

        {adHtml && plan !== 'PRO' && (pathname === '/' || pathname.startsWith('/ferramentas')) && <div className="mx-auto max-w-4xl px-4 pt-4 md:hidden"><div className="overflow-hidden rounded-xl bg-white p-2"><AdHtml html={adHtml} /></div></div>}

        <ShellMain maxWidth="max-w-[1440px]" className="pb-36 md:pb-10">{children}</ShellMain>
      </div>

      <MobileBottomNav platformAdmin={platformAdmin} plan={plan} planExpired={planExpired} wmsEnabled={wmsEnabled} />
      <PwaInstall />
      <ResponsiveTables />
    </div>
  );
}
