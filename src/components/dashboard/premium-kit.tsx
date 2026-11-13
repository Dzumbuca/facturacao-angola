'use client';

import { type ReactNode } from 'react';

/** Hero gradient construtor: hero navy com glow radial. */
export function PremiumHero({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`premium-hero overflow-hidden ${className}`}>
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}

/** KPI card com ring de luz subtil (Finexy-like). */
export function PremiumKpi({ label, value, detail, tone = 'neutral', icon }: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  icon?: ReactNode;
}) {
  const toneMap: Record<string, string> = {
    neutral: '#26354a',
    primary: '#021f87',
    success: '#227958',
    warning: '#b16d15',
    danger: '#ad4444',
  };
  return (
    <article className="machine-card-ring group rounded-[18px] border border-[#e3e9f1] bg-white dark:border-[#1e2a44] dark:bg-[#0d1627] p-4 shadow-[0_6px_18px_rgba(18,36,68,.05)] transition hover:-translate-y-[3px] hover:border-[#c9d4e2] hover:shadow-[0_16px_36px_rgba(18,36,68,.10)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#7a8799]">{label}</p>
        {icon && <span className="text-[#c3ccd9] transition group-hover:text-[#021f87]">{icon}</span>}
      </div>
      <p className="mt-2 tabular-nums text-2xl font-extrabold tracking-tight" style={{ color: toneMap[tone] }}>
        {value}
      </p>
      {detail && <p className="mt-1 text-[11px] leading-4 text-[#8490a0]">{detail}</p>}
    </article>
  );
}

/** Balance premium (navy gradient) para mostrar o total principal. */
export function PremiumBalance({ label, amount, trend, sublabel }: { label: string; amount: string; trend?: string; sublabel?: string }) {
  return (
    <article className="relative overflow-hidden rounded-[22px] border border-[#0f2b57] bg-gradient-to-br from-[#041f52] via-[#071f4b] to-[#0b2b6b] p-5 text-white shadow-[0_20px_48px_rgba(4,31,82,.32)] sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(120,170,255,.35),_transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,_rgba(60,210,255,.28),_transparent_70%)]" />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#a9c4ff]">{label}</p>
        <p className="mt-2 tabular-nums text-[32px] font-extrabold tracking-[-.03em] text-white sm:text-[38px]">{amount}</p>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          {trend && <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-[#8ee0b8]">{trend}</span>}
          {sublabel && <span className="text-[10px] uppercase tracking-[.1em] text-[#8fabd9]">{sublabel}</span>}
        </div>
      </div>
    </article>
  );
}

/** Painel branco com título/ícone e slot de cabeçalho. */
export function PremiumPanel({ title, kicker, action, children, className = '' }: { title?: string; kicker?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[18px] border border-[#e3e9f1] bg-white dark:border-[#1e2a44] dark:bg-[#0d1627] p-5 shadow-[0_6px_18px_rgba(18,36,68,.05)] sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {kicker && <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8793a6]">{kicker}</p>}
            {title && <h2 className="mt-0.5 text-base font-extrabold tracking-tight text-[#152236] sm:text-lg">{title}</h2>}
          </div>
          {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Linha de actividade com avatar/círculo de ícone e timestamp. */
export function PremiumActivityItem({ icon, title, meta, tone = 'neutral' }: { icon: ReactNode; title: string; meta?: string | ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'warning' }) {
  const toneColor: Record<string, string> = { neutral: '#021f87', success: '#227958', danger: '#ad4444', warning: '#b16d15' };
  return (
    <li className="flex items-start gap-3 border-b border-[#eef2f6] py-2.5 last:border-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1f5fb] text-[#021f87]" style={{ color: toneColor[tone] }}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#1c2d3f]">{title}</p>
        {meta && <p className="mt-0.5 text-xs text-[#8490a0]">{meta}</p>}
      </div>
    </li>
  );
}
