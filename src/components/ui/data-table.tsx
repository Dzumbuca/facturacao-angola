'use client';

import { type ReactNode } from 'react';

/** Badge uniforme para estados: sucesso, aviso, erro, neutro, primário. */
export function StatusBadge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary'; children: ReactNode }) {
  const map = {
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300/35',
    warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-300/35',
    danger: 'bg-rose-50 text-rose-700 ring-1 ring-rose-300/35',
    neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300/35',
    primary: 'bg-blue-50 text-blue-700 ring-1 ring-blue-300/35',
  } as const;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${map[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />{children}</span>;
}

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-[18px] border border-[#e2e8ef] bg-white shadow-[0_18px_38px_rgba(18,36,68,.06)] ${className}`}>
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#dfe6ee] bg-[#fbfcfe] px-6 py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-[14px] bg-white shadow-sm">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </div>
      <h3 className="mt-4 text-sm font-bold text-[#1c2d3f]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#8094a9]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
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
