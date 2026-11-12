'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RhPwa } from './rh-pwa';
import { DashboardIcon, IconBuilding, IconBriefcase, IconFileText, IconClock, IconCalendar, IconCoffee, IconPhone, IconCpu, IconSparkles, IconCurrency, IconCheckSquare, IconMail, IconMegaphone, IconUsersGroup, IconCog, IconUsers } from './icons';
import { ResponsiveTables } from '@/components/responsive-tables';

import type { ComponentType, SVGProps } from 'react';
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const activeLinks: { href: string; label: string; icon: IconComponent }[] = [
  { href: '/rh/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { href: '/rh/funcionarios', label: 'Funcionários', icon: IconUsers },
  { href: '/rh/departamentos', label: 'Departamentos', icon: IconBuilding },
  { href: '/rh/cargos', label: 'Cargos', icon: IconBriefcase },
  { href: '/rh/contratos', label: 'Contratos', icon: IconFileText },
  { href: '/rh/assiduidade', label: 'Assiduidade', icon: IconClock },
  { href: '/rh/horarios', label: 'Horários', icon: IconCalendar },
  { href: '/rh/ferias', label: 'Férias', icon: IconCoffee },
  { href: '/rh/ponto', label: 'Quiosque', icon: IconCpu },
  { href: '/rh/dispositivos', label: 'Dispositivos', icon: IconPhone },
  { href: '/rh/documentos', label: 'Documentos', icon: IconFileText },
  { href: '/rh/ia', label: 'Assistente IA', icon: IconSparkles },
  { href: '/rh/modelos', label: 'Modelos', icon: IconFileText },
  { href: '/rh/processamento-salarial', label: 'Processamento', icon: IconCurrency },
  { href: '/rh/pagamentos', label: 'Pagamentos', icon: IconSparkles },
  { href: '/rh/justificacoes', label: 'Justificações', icon: IconCheckSquare },
  { href: '/rh/notificacoes', label: 'Notificações', icon: IconMail },
  { href: '/rh/comunicados', label: 'Comunicados', icon: IconMegaphone },
  { href: '/rh/equipa', label: 'Equipa', icon: IconUsersGroup },
  { href: '/rh/configuracoes', label: 'Configurações', icon: IconCog },
];

const futureLinks = [
  { href: '/rh/payroll', label: 'Payroll Connect' },
  { href: '/rh/dispositivos', label: 'Dispositivos' },
];

const mobileLinks = [activeLinks[0], activeLinks[1], activeLinks[5], activeLinks[4]];

export function RhShell({ children, canManageMembers = false }: { children: ReactNode; canManageMembers?: boolean }) {
  const links = activeLinks.filter((link) => link.href !== '/rh/equipa' || canManageMembers);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const LinkIcon = ({ link }: { link: (typeof activeLinks)[number] }) => {
    const Icon = link.icon;
    return <Icon className="h-4 w-4 shrink-0" aria-hidden />;
  };

  return (
    <div className="min-h-dvh bg-[#f5f7fb] text-[#1c2d3f]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-[#071936] bg-[#0a1430] px-4 py-5 text-white md:flex">
        <Link href="/rh/dashboard" className="flex items-center gap-3 rounded-lg px-2">
          <img src="/icons/rh-logo.png" alt="Machine RH" className="h-10 w-auto rounded-lg bg-white object-contain p-1" />
          <span>
            <strong className="block text-[15px] tracking-[.04em] text-white">MACHINE RH</strong>
            <span className="text-[10px] uppercase tracking-[.12em] text-blue-200/70">Recursos Humanos</span>
          </span>
        </Link>

        <nav aria-label="Navegação Machine RH" className="mt-6 flex-1 space-y-5 overflow-y-auto">
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-blue-200/60">Gestão</p>
            <ul className="mt-2 space-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] transition ${isActive(link.href) ? 'bg-[#021f87] font-semibold text-white' : 'text-blue-100/80 hover:bg-white/5'}`}
                  >
                    <LinkIcon link={link} />{link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-blue-200/60">Brevemente</p>
            <ul className="mt-2 space-y-1">
              {futureLinks.map((link) => (
                <li key={link.href}>
                  <span className="flex min-h-9 cursor-not-allowed items-center justify-between rounded-lg px-3 text-[13px] text-[#9aa8b8]">
                    {link.label}<span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-100/60">Breve</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <RhPwa />
          <Link href="/" className="block text-xs font-medium text-blue-100/70 hover:text-white">← Voltar à Machine Facturas</Link>
        </div>
      </aside>

      <div className="md:ml-[236px]">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#dfe7f0] bg-white/95 px-4 py-2.5 backdrop-blur md:px-7 md:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[.14em] text-[#8a99ab] sm:block">Machine RH</p>
              <p className="truncate text-sm font-bold text-[#0a1430] md:text-base">
                {links.find((l) => isActive(l.href))?.label ?? 'Recursos Humanos'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-lg border border-[#dfe7f0] px-3 py-1.5 text-xs font-medium text-[#52667a] hover:bg-[#f7f9fc] sm:inline-flex">Machine Facturas</Link>
            <span className="hidden rounded-full bg-[#021f87] px-2.5 py-1 text-[11px] font-semibold text-white sm:inline-flex">RH</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 md:px-7 md:pb-10 md:pt-7">{children}</main>
      </div>

      <nav aria-label="Navegação móvel Machine RH" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#dfe7f0] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {mobileLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${isActive(link.href) ? 'text-[#021f87]' : 'text-[#708195]'}`}
          >
            <LinkIcon link={link} />
            {link.label}
          </Link>
        ))}
      </nav>
      <ResponsiveTables />
    </div>
  );
}
