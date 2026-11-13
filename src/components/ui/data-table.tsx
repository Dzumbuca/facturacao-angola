'use client';

import { type ReactNode } from 'react';

/** Badge uniforme para estados: sucesso, aviso, erro, neutro, primário. */
export function StatusBadge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary'; children: ReactNode }) {
  const map = {
    success: 'ds-badge ds-badge-success',
    warning: 'ds-badge ds-badge-warning',
    danger: 'ds-badge ds-badge-danger',
    neutral: 'ds-badge ds-badge-neutral',
    primary: 'ds-badge ds-badge-info',
  } as const;
  return <span className={map[tone]}>{children}</span>;
}

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgb(18_36_68/.06),0_4px_16px_rgb(18_36_68/.06)] ${className}`}>
      <table className="ds-table">
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
