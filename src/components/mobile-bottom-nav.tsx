'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NavIcon } from '@/components/nav-icons';

type NavItem = { href: string; label: string; icon: string };
type PrimaryItem = NavItem & { exact?: boolean };

const primary: PrimaryItem[] = [
  { href: '/', label: 'Início', icon: 'home', exact: true },
  { href: '/invoices', label: 'Operações', icon: 'receipt' },
  { href: '/customers', label: 'Clientes', icon: 'users' },
  { href: '/produtos', label: 'Produtos', icon: 'box' },
];

function matches(pathname: string, item: PrimaryItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function MobileBottomNav({ platformAdmin = false, plan = 'FREE', planExpired = false, wmsEnabled = false }: { platformAdmin?: boolean; plan?: string; planExpired?: boolean; wmsEnabled?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousActive = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousActive?.focus?.();
    };
  }, [open]);

  const moreGroups: { title: string; links: NavItem[] }[] = [
    {
      title: 'Gestão',
      links: [
        { href: '/documentos', label: 'Documentos', icon: 'file' },
        { href: '/ferramentas', label: 'Ferramentas', icon: 'tools' },
      ],
    },
    ...(wmsEnabled ? [{
      title: 'Armazém',
      links: [
        { href: '/stock', label: 'Armazém e stock', icon: 'layers' },
        { href: '/warehouses', label: 'Armazéns', icon: 'building' },
      ],
    }] : []),
    {
      title: 'Análise e conta',
      links: [
        { href: '/reports', label: 'Relatórios', icon: 'chart' },
        { href: '/apps', label: 'Aplicações', icon: 'grid' },
        { href: '/empresa', label: 'Empresa', icon: 'building' },
        { href: '/pagamento', label: 'Plano e pagamento', icon: 'wallet' },
      ],
    },
  ];

  const planLabel = planExpired ? 'Plano expirado' : plan === 'PRO' ? 'Plano Pro' : 'Plano Grátis';
  const moreActive = moreGroups.some((group) => group.links.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)));

  return (
    <>
      <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e1e8f0] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const active = matches(pathname, item);
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[10px] font-semibold transition-colors ${active ? 'text-[#021f87]' : 'text-[#708195] active:text-[#021f87]'}`}
                >
                  <span className={`absolute top-0 h-[2px] w-7 rounded-full transition-opacity ${active ? 'bg-[#021f87] opacity-100' : 'opacity-0'}`} />
                  <span className={`flex h-7 w-10 items-center justify-center rounded-xl transition-colors ${active ? 'bg-[#eef4ff]' : ''}`}>
                    <NavIcon name={item.icon} className="h-[20px] w-[20px]" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              ref={triggerRef}
              type="button"
              aria-label="Mais opções"
              aria-expanded={open}
              aria-controls="mobile-more-sheet"
              onClick={() => setOpen((value) => !value)}
              className={`relative flex min-h-[58px] w-full flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[10px] font-semibold transition-colors ${moreActive || open ? 'text-[#021f87]' : 'text-[#708195]'}`}
            >
              <span className={`absolute top-0 h-[2px] w-7 rounded-full transition-opacity ${moreActive || open ? 'bg-[#021f87] opacity-100' : 'opacity-0'}`} />
              <span className={`flex h-7 w-10 items-center justify-center rounded-xl transition-colors ${moreActive || open ? 'bg-[#eef4ff]' : ''}`}>
                <NavIcon name="more" className="h-[20px] w-[20px]" />
              </span>
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#071936]/55 backdrop-blur-[2px]" />
          <section
            ref={panelRef}
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções"
            className="sheet-panel absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-[#f7f9fc] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-[#e1e8f0] bg-[#f7f9fc]/95 px-5 pb-3 pt-3 backdrop-blur">
              <div className="mx-auto absolute inset-x-0 top-1.5 h-1 w-10 rounded-full bg-[#c8d2de]" aria-hidden="true" />
              <div className="pt-2">
                <h2 className="text-base font-bold text-[#1c2d3f]">Mais</h2>
                <p className="text-xs text-[#708195]">{planLabel}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-xl text-[#708195] transition hover:bg-[#e9eef5]">×</button>
            </div>

            <div className="space-y-5 px-5 pt-4">
              {moreGroups.map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[.12em] text-[#708195]">{group.title}</h3>
                  <ul className="overflow-hidden rounded-xl border border-[#e1e8f0] bg-white">
                    {group.links.map((link, index) => {
                      const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                      return (
                        <li key={link.href} className={index > 0 ? 'border-t border-[#edf1f5]' : ''}>
                          <Link href={link.href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 px-4 py-3 text-sm transition-colors ${active ? 'bg-[#eef4ff] font-semibold text-[#021f87]' : 'text-[#26354a] active:bg-[#f2f6fb]'}`}>
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white text-[#021f87]' : 'bg-[#f2f6fb] text-[#607286]'}`}><NavIcon name={link.icon} /></span>
                            <span className="min-w-0 flex-1 truncate">{link.label}</span>
                            <span aria-hidden="true" className="text-[#9aa8b8]">›</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {platformAdmin && (
                <section aria-label="Plataforma">
                  <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[.12em] text-[#708195]">Plataforma</h3>
                  <ul className="overflow-hidden rounded-xl border border-[#e1e8f0] bg-white">
                    <li>
                      <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm text-[#26354a] active:bg-[#f2f6fb]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f6fb] text-[#607286]"><NavIcon name="settings" /></span>
                        <span className="min-w-0 flex-1 truncate">Administração da plataforma</span>
                        <span aria-hidden="true" className="text-[#9aa8b8]">›</span>
                      </Link>
                    </li>
                  </ul>
                </section>
              )}

              {plan !== 'PRO' && (
                <Link href="/pagamento" onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-xl bg-[#021f87] px-4 py-3.5 text-sm font-semibold text-white transition active:bg-[#061965]">
                  <span>{planExpired ? 'Renovar o plano' : 'Conhecer os pacotes pagos'}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
