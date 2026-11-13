'use client';

import { type ReactNode } from 'react';

/** Token semântico: card base. */
const cardBase = 'rounded-[18px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition-colors';

/** Hero navy distintivo do produto. */
export function PremiumHero({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`premium-hero ${className}`}>
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}

/** KPI card com contraste garantido em light e dark. */
export function PremiumKpi({ label, value, detail, tone = 'neutral', icon }: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  icon?: ReactNode;
}) {
  const toneAccent: Record<typeof tone, string> = {
    neutral: 'var(--text)',
    primary: 'var(--blue)',
    success: '#227958',
    warning: '#b16d15',
    danger: '#ad4444',
  };
  return (
    <article className={`${cardBase} group p-4 hover:-translate-y-[2px] sm:p-5`}>
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">{label}</p>
          {icon && <span className="text-[var(--text-muted)] transition group-hover:text-[var(--blue)]">{icon}</span>}
        </div>
        <div>
          <p className="tabular-nums text-xl font-extrabold tracking-tight sm:text-2xl" style={{ color: toneAccent[tone] }}>{value}</p>
          {detail && <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)] sm:text-[11px]">{detail}</p>}
        </div>
      </div>
    </article>
  );
}

/** Cartão navy com gradiente — o destaque de "facturação do período". */
export function PremiumBalance({ label, amount, trend, sublabel }: { label: string; amount: string; trend?: string; sublabel?: string }) {
  return (
    <article className="relative overflow-hidden rounded-[22px] border border-[#0f2b57] bg-gradient-to-br from-[#041f52] via-[#071f4b] to-[#0b2b6b] p-5 text-white shadow-[var(--shadow-soft)] sm:p-6 dark:border-[#1a2440]">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(120,170,255,.35),_transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,_rgba(60,210,255,.28),_transparent_70%)]" />
      <div className="relative">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#a9c4ff]">{label}</p>
        <p className="tabular-nums mt-2 text-[30px] font-extrabold tracking-[-.03em] text-white sm:text-[36px]">{amount}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {trend && <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-[#8ee0b8]">{trend}</span>}
          {sublabel && <span className="text-[10px] uppercase tracking-[.1em] text-[#a4b8dc]">{sublabel}</span>}
        </div>
      </div>
    </article>
  );
}

/** Painel base com título, kicker, acção e slot de conteúdo. */
export function PremiumPanel({ title, kicker, action, children, className = '' }: { title?: string; kicker?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${cardBase} p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {kicker && <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--text-muted)]">{kicker}</p>}
            {title && <h2 className="mt-0.5 text-[15px] font-extrabold tracking-tight text-[var(--text)] sm:text-base">{title}</h2>}
          </div>
          {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Item de actividade: ícone tonalizado, título e meta. */
export function PremiumActivityItem({ icon, title, meta, tone = 'neutral' }: { icon: ReactNode; title: string; meta?: string | ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'warning' }) {
  const toneBg: Record<typeof tone, string> = { neutral: 'var(--surface-raised)', success: '#ecfaf2', danger: '#fdf2f2', warning: '#fdf6e9' };
  return (
    <li className="flex items-start gap-3 border-b border-[var(--line)] py-2.5 last:border-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: toneBg[tone] }}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[var(--text)]">{title}</p>
        {meta && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{meta}</p>}
      </div>
    </li>
  );
}

/** Botão CTA principal. */
export function PremiumCta({ href, variant = 'primary', children }: { href?: string; variant?: 'primary' | 'ghost'; children: ReactNode }) {
  const base = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const styles = variant === 'primary'
    ? `${base} bg-[#021f87] text-white shadow-[0_10px_24px_rgba(2,31,135,.32)] hover:-translate-y-0.5 hover:bg-[#0634b8] focus-visible:outline-[#021f87]`
    : `${base} border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-raised)] focus-visible:outline-[var(--blue)]`;
  const Tag = href ? 'a' : 'button';
  return <Tag href={href} className={styles}>{children}</Tag>;
}
