'use client';

import { type ReactNode } from 'react';

/** Card premium: fundo arejado, sombra suave, cantos grandes. */
export function PremiumCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`premium-card overflow-hidden bg-white/95 p-5 backdrop-blur-sm sm:p-6 ${className}`}>{children}</div>
  );
}

/** Layout split desktop: coluna principal (~70%) + sidebar contextual (~30%). Empilha em mobile. */
export function FormSplit({ main, sidebar }: { main: ReactNode; sidebar?: ReactNode }) {
  if (!sidebar) return <div className="space-y-4">{main}</div>;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
      <div className="space-y-4">{main}</div>
      <aside className="space-y-4">{sidebar}</aside>
    </div>
  );
}

/** Sidebar de resumo/preenchimento. Mostra completion %, contexto e atalhos. */
export function FormSidebar({ title, lines, progress, footer }: {
  title: string;
  lines: { label: string; value?: string | null }[];
  progress?: number; // 0..100
  footer?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, progress ?? 0));
  return (
    <div className="premium-sidebar space-y-4 p-5">
      <div className="flex items-center justify-between gap-3 border-b border-[#e8edf2] pb-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#708195]">{title}</h3>
        <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-bold text-[#021f87]">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#eef2f6]"><div className="h-full rounded-full bg-gradient-to-r from-[#021f87] via-[#2b5ce6] to-[#5aa2ff] transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      <dl className="space-y-1.5 text-xs">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start justify-between gap-3 border-b border-dashed border-[#edf1f6] py-1.5 last:border-0">
            <dt className="text-[#8094a9]">{line.label}</dt>
            <dd className="max-w-[60%] text-right font-semibold text-[#1c2d3f]">{line.value || '—'}</dd>
          </div>
        ))}
      </dl>
      {footer && <div className="pt-2 text-xs text-[#607286]">{footer}</div>}
    </div>
  );
}

export type Step = { label: string; hint?: string };

/** Stepper horizontal: etapa actual destacada, concluídas marcadas. */
export function FormStepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div aria-label="Etapas do formulário" className="overflow-x-auto">
      <ol className="flex items-center gap-0">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={index} className="flex items-center">
              <div className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1.5 transition ${active ? 'bg-[#021f87] text-white shadow-[0_6px_16px_rgba(2,31,135,.35)]' : done ? 'bg-[#eef4ff] text-[#021f87]' : 'text-[#8aa1bd]'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-white text-[#021f87]' : done ? 'bg-[#021f87] text-white' : 'bg-[#eef2f6] text-[#607286]'}`}>
                  {done ? '✓' : index + 1}
                </span>
                <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap">{step.label}</span>
              </div>
              {index < steps.length - 1 && <div className={`h-px w-4 sm:w-8 ${done ? 'bg-[#9db5ff]' : 'bg-[#e2e8ef]'}`} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Cabeçalho de formulário com ícone grande e título. */
export function FormHero({ eyebrow, title, description, icon }: { eyebrow?: string; title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-[#e8edf2] pb-5">
      {icon && <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#021f87] to-[#2b5ce6] text-white shadow-[0_8px_22px_rgba(2,31,135,.35)]">{icon}</div>}
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#021f87]">{eyebrow}</p>}
        <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-[#1c2d3f] sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-xs leading-5 text-[#64768a] sm:text-sm">{description}</p>}
      </div>
    </div>
  );
}
