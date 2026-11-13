import { type ReactNode } from 'react';
import Link from 'next/link';

type Tone = 'navy' | 'neutral';

/** Container do aside (sidebar) do ecossistema. */
export function ShellAside({ children, width, tone = 'navy', className = '' }: { children: ReactNode; width?: string; tone?: Tone; className?: string }) {
  const widthClass = width ?? 'md:w-[236px]';
  const navyClasses = 'border-r border-white/5 bg-gradient-to-b from-[#040d26] via-[#071936] to-[#0b2240] text-white';
  const neutralClasses = 'border-r border-[var(--line)] bg-[var(--surface)] text-[var(--text)]';
  return (
    <aside aria-label="Menu principal" className={`fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden px-4 py-5 md:flex ${tone === 'navy' ? navyClasses : neutralClasses} ${widthClass} ${className}`}>
      {children}
    </aside>
  );
}

/** Cabeçalho da barra superior partilhada. */
export function ShellTopbar({ brand, title, eyebrow, right, tone = 'navy' }: { brand?: ReactNode; title: string; eyebrow?: string; right?: ReactNode; tone?: Tone }) {
  const borderTone = tone === 'navy' ? 'border-[#e6ebf3] dark:border-[#1e2a44]' : 'border-[var(--line)]';
  return (
    <header className={`sticky top-0 z-30 flex items-center justify-between gap-3 border-b ${borderTone} bg-[var(--surface)]/95 px-4 py-2.5 backdrop-blur md:px-7 md:py-3.5`}>
      <div className="flex min-w-0 items-center gap-2.5">{brand}<div className="min-w-0">{eyebrow && <p className="hidden text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)] sm:block">{eyebrow}</p>}<p className="truncate text-sm font-bold text-[var(--text)] md:text-base">{title}</p></div></div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}

/** Wrapper de conteúdo principal. */
export function ShellMain({ children, maxWidth = 'max-w-[1280px]', className = '' }: { children: ReactNode; maxWidth?: string; className?: string }) {
  return <main className={`mx-auto w-full ${maxWidth} px-4 pb-28 pt-5 md:px-7 md:pb-10 md:pt-7 ${className}`}>{children}</main>;
}

/** Entrada do sidebar com ícone e estado activo (usado por todos os shells). */
export function ShellNavLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active?: boolean }) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition ${active ? 'bg-white/10 font-semibold text-white' : 'text-white/80 hover:bg-white/5 hover:text-white'}`}>
      <span className="shrink-0 text-current">{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
