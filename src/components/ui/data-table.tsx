'use client';

import { type ReactNode } from 'react';

/** Badge uniforme para estados: sucesso, aviso, erro, neutro, primário. */
export function StatusBadge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary'; children: ReactNode }) {
  const map = {
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300/35 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40',
    warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-300/35 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/40',
    danger: 'bg-rose-50 text-rose-700 ring-1 ring-rose-300/35 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/40',
    neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300/35 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    primary: 'bg-blue-50 text-blue-700 ring-1 ring-blue-300/35 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-800/40',
  } as const;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${map[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />{children}</span>;
}

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-[18px] border border-[#e2e8ef] bg-white shadow-[var(--shadow-card)] dark:border-[#1e2a44] dark:bg-[#0d1627] dark:shadow-[0_18px_38px_rgba(0,0,0,.35)] ${className}`}>
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#dfe6ee] bg-gradient-to-b from-[#fbfcfe] to-[#f7f9fd] px-6 py-12 text-center shadow-[var(--shadow-inset)] dark:border-[#1e2a44] dark:from-[#0d1627] dark:to-[#0b1220]">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-[var(--shadow-card)] dark:bg-[#162038]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[#c0cbda] dark:text-[#8295b4]"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </div>
      <h3 className="mt-4 text-sm font-extrabold tracking-tight text-[#1c2d3f] dark:text-slate-100">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-xs text-xs leading-6 text-[#8094a9] dark:text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const stateTone = (state: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' => {
  if (['PAID', 'CONFIRMED', 'ACTIVO', 'SUCCESS'].includes(state)) return 'success';
  if (['PARTIALLY_PAID', 'PENDING', 'DRAFT'].includes(state)) return 'warning';
  if (['OVERDUE', 'CANCELLED', 'FAILURE'].includes(state)) return 'danger';
  if (['ISSUED', 'ATIVO', 'RENOVADO'].includes(state)) return 'primary';
  return 'neutral';
};
