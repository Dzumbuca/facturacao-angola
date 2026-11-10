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

type NavLink = { href: string; label: string; icon: string };
const groups: { title: string; links: NavLink[] }[] = [
  { title: 'Principal', links: [{ href: '/', label: 'Dashboard', icon: 'grid' }] },
  { title: 'Documentos Empresariais', links: [{ href: '/documentos', label: 'Documentos', icon: 'file' }] },
  { title: 'Ferramentas', links: [{ href: '/ferramentas', label: 'Centro de ferramentas', icon: 'tools' }] },
  { title: 'Operações', links: [{ href: '/invoices', label: 'Facturas', icon: 'file' }, { href: '/customers', label: 'Clientes', icon: 'users' }, { href: '/produtos', label: 'Produtos e serviços', icon: 'box' }, { href: '/warehouses', label: 'Armazéns', icon: 'building' }] },
  { title: 'Análise', links: [{ href: '/reports', label: 'Relatórios', icon: 'chart' }] },
  { title: 'Empresa', links: [{ href: '/empresa', label: 'Perfil da empresa', icon: 'building' }] },
];
const titles: Record<string, string> = {
  '/': 'Dashboard',
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

  return (
    <div className="min-h-dvh">
      <aside aria-label="Menu principal" className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col overflow-hidden border-r border-white/10 bg-[#071936] px-4 py-6 text-white md:flex lg:w-[252px] lg:px-5">
        <Link href="/" className="mb-5 flex shrink-0 items-center gap-3 rounded-md px-2" aria-label="Machine Facturas, início">
          <img src="/logo.png" width="800" height="600" alt="Facturação" className="h-9 w-auto max-w-[92px] rounded-md bg-white object-contain px-1.5 py-1" />
          <span className="leading-tight"><strong className="block text-[14px] tracking-[.12em]">MACHINE FACTURAS</strong><span className="text-[10px] uppercase tracking-[.1em] text-slate-400">Gestão financeira</span></span>
        </Link>
        <nav aria-label="Navegação principal" className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain py-1">
          {groups.map((group) => <section key={group.title} aria-label={group.title}>
            <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{group.title}</h2>
            <ul className="space-y-0.5">{group.links.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
              return <li key={href}><Link href={href} aria-current={active ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${active ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:bg-[#7795ff]' : 'text-slate-300 hover:bg-white/[.06] hover:text-white'}`}><NavIcon name={icon} />{label}</Link></li>;
            })}</ul>
          </section>)}
          {platformAdmin && <section aria-label="Plataforma">
            <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Plataforma</h2>
            <ul className="space-y-0.5"><li><Link href="/admin" aria-current={pathname === '/admin' || pathname.startsWith('/admin/') ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${pathname === '/admin' || pathname.startsWith('/admin/') ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:bg-[#7795ff]' : 'text-slate-300 hover:bg-white/[.06] hover:text-white'}`}><NavIcon name="building" />Administração da plataforma</Link></li></ul>
          </section>}
        </nav>
        <div className="mt-3 max-h-[46vh] shrink-0 space-y-3 overflow-y-auto overscroll-contain border-t border-white/10 px-3 pt-3">
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
      </aside>

      <div className="min-w-0 md:ml-[220px] lg:ml-[252px]">
        <header className="sticky top-0 z-30 border-b border-[#e1e8f0] bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2.5 md:px-8 md:py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/logo.png" width="800" height="600" alt="Facturação" className="h-8 w-auto max-w-[72px] shrink-0 rounded-md bg-white object-contain px-1 py-0.5 md:hidden" />
              <div className="min-w-0">
                <p className="hidden text-[10px] font-bold uppercase tracking-[.14em] text-[#708195] sm:block">Facturação Angola</p>
                <h1 className="truncate text-[15px] font-bold text-[#1c2d3f] md:text-lg">{title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full border border-[#e1e8f0] bg-[#f7f9fc] px-3 py-1.5 text-xs font-medium text-[#607286] sm:inline-flex">Área de gestão</span>
              <ThemeToggle compact />
            </div>
          </div>
        </header>

        {adHtml && plan !== 'PRO' && (pathname === '/' || pathname.startsWith('/ferramentas')) && <div className="mx-auto max-w-4xl px-4 pt-4 md:hidden"><div className="overflow-hidden rounded-xl bg-white p-2"><AdHtml html={adHtml} /></div></div>}

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-36 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>

      <MobileBottomNav platformAdmin={platformAdmin} plan={plan} planExpired={planExpired} wmsEnabled={wmsEnabled} />
      <PwaInstall />
      <ResponsiveTables />
    </div>
  );
}
