'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AdHtml } from '@/components/ad-html';
import { ThemeToggle } from '@/components/theme-toggle';

type NavLink = { href: string; label: string; icon: string };
const groups: { title: string; links: NavLink[] }[] = [
  { title: 'Principal', links: [{ href: '/', label: 'Dashboard', icon: 'grid' }] },
  { title: 'Ferramentas', links: [{ href: '/ferramentas', label: 'Centro de ferramentas', icon: 'tools' }] },
  { title: 'Operações', links: [{ href: '/invoices', label: 'Facturas', icon: 'file' }, { href: '/customers', label: 'Clientes', icon: 'users' }, { href: '/produtos', label: 'Produtos e serviços', icon: 'box' }] },
  { title: 'Análise', links: [{ href: '/reports', label: 'Relatórios', icon: 'chart' }] },
  { title: 'Empresa', links: [{ href: '/empresa', label: 'Perfil da empresa', icon: 'building' }] },
] ;
const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/invoices': 'Facturas',
  '/invoices/new': 'Emitir fatura',
  '/ferramentas': 'Centro de ferramentas',
  '/reports': 'Relatórios',
  '/customers': 'Clientes',
  '/produtos': 'Produtos',
  '/empresa': 'Dados da empresa',
};

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M8 14h8M8 18h8"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    box: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 7v10l9 5 9-5V7M12 12v10"/></>,
    building: <><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01M16 13v.01M16 16v.01M16 19v.01"/></>,
    tools: <><path d="M14.7 6.3a4.5 4.5 0 0 0-5.8 5.8L3 18a2.1 2.1 0 0 0 3 3l5.9-5.9a4.5 4.5 0 0 0 5.8-5.8l-2.8 2.8-3-3 2.8-2.8Z"/><path d="m17 3 4 4"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]">{paths[name]}</svg>;
}

export function AppShell({ children, platformAdmin = false, plan = 'FREE', adHtml = null, planDaysLeft = null, planExpired = false }: { children: ReactNode; platformAdmin?: boolean; plan?: string; adHtml?: string | null; planDaysLeft?: number | null; planExpired?: boolean }) {
  const pathname = usePathname();
  const title = titles[pathname] ?? 'Facturação Angola';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      {mobileOpen && <button type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-[#071936]/50 md:hidden" />}
      <aside id="primary-sidebar" aria-label="Menu principal" aria-hidden={isMobile && !mobileOpen} inert={isMobile && !mobileOpen} className={`fixed inset-y-0 left-0 z-50 flex h-screen h-dvh w-[min(84vw,280px)] flex-col overflow-hidden border-r border-white/10 bg-[#071936] px-4 py-5 text-white transition-transform duration-200 md:w-[220px] md:translate-x-0 md:px-4 md:py-6 lg:w-[252px] lg:px-5 ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <Link href="/" className="mb-5 flex shrink-0 items-center gap-3 rounded-md px-2" aria-label="BlackMachine, início" onClick={() => setMobileOpen(false)}>
          <img src="/logo.png" width="800" height="600" alt="Facturas" className="h-9 w-auto max-w-[92px] rounded-md bg-white object-contain px-1.5 py-1" />
          <span className="leading-tight"><strong className="block text-[14px] tracking-[.12em]">MACHINE FACTURAS</strong><span className="text-[10px] uppercase tracking-[.1em] text-slate-400">Gestão financeira</span></span>
        </Link>
        <nav aria-label="Navegação principal" className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain py-1">
          {groups.map((group) => <section key={group.title} aria-label={group.title}>
            <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{group.title}</h2>
            <ul className="space-y-0.5">{group.links.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
              return <li key={href}><Link href={href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${active ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:bg-[#7795ff]' : 'text-slate-300 hover:bg-white/[.06] hover:text-white'}`}><NavIcon name={icon}/>{label}</Link></li>;
            })}</ul>
          </section>)}
          {platformAdmin && <section aria-label="Plataforma">
            <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Plataforma</h2>
            <ul className="space-y-0.5"><li><Link href="/admin" onClick={() => setMobileOpen(false)} aria-current={pathname === '/admin' || pathname.startsWith('/admin/') ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${pathname === '/admin' || pathname.startsWith('/admin/') ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:bg-[#7795ff]' : 'text-slate-300 hover:bg-white/[.06] hover:text-white'}`}><NavIcon name="building"/>Administração da plataforma</Link></li></ul>
          </section>}
          {/* Telemóvel: moeda, plano e upsell Pro dentro da área rolável do menu */}
          <section aria-label="Conta" className="border-t border-white/10 px-3 pt-3 md:hidden">
            <p className="text-[10px] uppercase tracking-[.12em] text-slate-500">Kwanza · AOA · Plano {planExpired ? 'expirou' : plan === 'PRO' ? 'Pro' : 'Grátis'}</p>
            {planExpired && <Link href="/pagamento" onClick={() => setMobileOpen(false)} className="mt-2 block rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300">Plano expirou — Renovar →</Link>}
            {plan === 'PRO' && planDaysLeft !== null && planDaysLeft <= 14 && <Link href="/pagamento" onClick={() => setMobileOpen(false)} className="mt-2 block rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300">Expira em {planDaysLeft} {planDaysLeft === 1 ? 'dia' : 'dias'} — Renovar →</Link>}
            {plan !== 'PRO' && <Link href="/pagamento" onClick={() => setMobileOpen(false)} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-gradient-to-br from-[#2878d0] to-[#102b46] px-3 py-2.5 text-[11px] font-bold text-white">
              <span>⭐ Plano Pro — sem anúncios</span><span>→</span>
            </Link>}
          </section>
        </nav>
        <div className="mt-3 hidden max-h-[46vh] shrink-0 space-y-3 overflow-y-auto overscroll-contain border-t border-white/10 px-3 pt-3 md:block">
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
              <p className="text-xs font-bold">Plano Pro</p>
              <p className="mt-1 text-[11px] leading-4 text-blue-100">Sem anúncios, facturas ilimitadas, SAFT-AO e equipa. Desde 9.900 Kz/mês.</p>
              <Link href="/pagamento" onClick={() => setMobileOpen(false)} className="mt-2 inline-flex rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#102b46] transition hover:bg-blue-50">Subir de plano</Link>
            </div>
          </div>}
        </div>
      </aside>
      <div className="min-w-0 md:ml-[220px] lg:ml-[252px]">
        <header className="border-b border-[#e1e8f0] bg-white px-4 py-3 md:px-8 md:py-4">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button ref={menuButtonRef} type="button" aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobileOpen} aria-controls="primary-sidebar" onClick={() => setMobileOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-md bg-[#071936] text-white md:hidden"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">{mobileOpen ? <path d="m6 6 12 12M18 6 6 18"/> : <path d="M4 6h16M4 12h16M4 18h16"/>}</svg></button>
              <img src="/logo.png" width="800" height="600" alt="Facturas" className="h-8 w-auto max-w-[80px] rounded-md bg-white object-contain px-1.5 py-1 md:hidden" />
              <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#708195] md:hidden">Facturação Angola</p><h1 className="text-base font-bold text-[#1c2d3f] md:text-lg">{title}</h1></div>
            </div>
            <div className="flex items-center gap-2"><span className="hidden rounded-full border border-[#e1e8f0] bg-[#f7f9fc] px-3 py-1.5 text-xs font-medium text-[#607286] sm:inline-flex">Área de gestão</span><ThemeToggle compact /></div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
