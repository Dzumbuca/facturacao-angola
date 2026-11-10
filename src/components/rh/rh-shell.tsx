'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RhPwa } from './rh-pwa';
import { ResponsiveTables } from '@/components/responsive-tables';

const activeLinks = [
  { href: '/rh/dashboard', label: 'Dashboard', icon: '◫' },
  { href: '/rh/funcionarios', label: 'Funcionários', icon: '◉' },
  { href: '/rh/departamentos', label: 'Departamentos', icon: '▤' },
  { href: '/rh/cargos', label: 'Cargos', icon: '◇' },
  { href: '/rh/contratos', label: 'Contratos', icon: '▧' },
  { href: '/rh/assiduidade', label: 'Assiduidade', icon: '◷' },
  { href: '/rh/horarios', label: 'Horários', icon: '◔' },
  { href: '/rh/ferias', label: 'Férias', icon: '☀' },
  { href: '/rh/ponto', label: 'Quiosque', icon: '▣' },
  { href: '/rh/configuracoes', label: 'Configurações', icon: '⚙' },
];

const futureLinks = [
  { href: '/rh/processamento-salarial', label: 'Processamento salarial' },
  { href: '/rh/documentos', label: 'Documentos' },
  { href: '/rh/modelos', label: 'Modelos' },
  { href: '/rh/payroll', label: 'Payroll Connect' },
  { href: '/rh/dispositivos', label: 'Dispositivos' },
];

const mobileLinks = [activeLinks[0], activeLinks[1], activeLinks[5], activeLinks[4]];

export function RhShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-[#f5f7fb] text-[#1c2d3f]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-[#dfe7f0] bg-white px-4 py-5 md:flex">
        <Link href="/rh/dashboard" className="flex items-center gap-3 rounded-lg px-2">
          <img src="/icons/rh-icon-192.png" width="40" height="40" alt="Machine RH" className="h-10 w-10 rounded-lg" />
          <span>
            <strong className="block text-[15px] tracking-[.04em] text-[#021f87]">MACHINE RH</strong>
            <span className="text-[10px] uppercase tracking-[.12em] text-[#708195]">Recursos Humanos</span>
          </span>
        </Link>

        <nav aria-label="Navegação Machine RH" className="mt-6 flex-1 space-y-5 overflow-y-auto">
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#8a99ab]">Gestão</p>
            <ul className="mt-2 space-y-1">
              {activeLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] transition ${isActive(link.href) ? 'bg-[#eef4ff] font-semibold text-[#021f87]' : 'text-[#4a5d70] hover:bg-[#f5f8fc]'}`}
                  >
                    <span aria-hidden="true" className="w-4 text-center">{link.icon}</span>{link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#8a99ab]">Brevemente</p>
            <ul className="mt-2 space-y-1">
              {futureLinks.map((link) => (
                <li key={link.href}>
                  <span className="flex min-h-9 cursor-not-allowed items-center justify-between rounded-lg px-3 text-[13px] text-[#9aa8b8]">
                    {link.label}<span className="rounded bg-[#f1f4f8] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">Breve</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="mt-4 space-y-3 border-t border-[#e7edf3] pt-4">
          <RhPwa />
          <Link href="/" className="block text-xs font-medium text-[#607286] hover:text-[#021f87]">← Voltar à Machine Facturas</Link>
        </div>
      </aside>

      <div className="md:ml-[236px]">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#dfe7f0] bg-white/95 px-4 py-2.5 backdrop-blur md:px-7 md:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/icons/rh-icon-192.png" width="32" height="32" alt="Machine RH" className="h-8 w-8 rounded-md md:hidden" />
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[.14em] text-[#8a99ab] sm:block">Machine RH</p>
              <p className="truncate text-sm font-bold text-[#1c2d3f] md:text-base">
                {activeLinks.find((l) => isActive(l.href))?.label ?? 'Recursos Humanos'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-lg border border-[#dfe7f0] px-3 py-1.5 text-xs font-medium text-[#52667a] hover:bg-[#f7f9fc] sm:inline-flex">Machine Facturas</Link>
            <span className="hidden rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-semibold text-[#021f87] sm:inline-flex">RH</span>
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
            <span aria-hidden="true" className="text-base">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>
      <ResponsiveTables />
    </div>
  );
}
