'use client';

import { useState, useId, useMemo } from 'react';

type Point = { date: string; value: number };
type SeriesKey = 'invoice' | 'receipt';

const money = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(v);
const compact = (v: number) => {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-AO', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString('pt-AO', { maximumFractionDigits: 1 })} mil`;
  return String(Math.round(v));
};
const fullDate = (value: string) => {
  const date = new Date(`${value.length === 7 ? `${value}-01` : value}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-AO', { timeZone: 'Africa/Luanda', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};
const shortDate = (value: string) => {
  const date = new Date(`${value.length === 7 ? `${value}-01` : value}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-AO', { timeZone: 'Africa/Luanda', day: '2-digit', month: 'short' }).format(date);
};

export function EvolutionChartCard({ invoices, receipts, periodStart, periodEnd }: {
  invoices: Point[];
  receipts: Point[];
  periodStart: string;
  periodEnd: string;
}) {
  const [selected, setSelected] = useState<SeriesKey>('invoice');
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const points = selected === 'invoice' ? invoices : receipts;
  const label = selected === 'invoice' ? 'Facturação emitida' : 'Recebimentos confirmados';
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const max = useMemo(() => Math.max(...points.map((p) => p.value), 1), [points]);

  const monthLabel = useMemo(() => {
    const s = new Date(periodStart);
    const e = new Date(periodEnd);
    const fmt = (d: Date) => new Intl.DateTimeFormat('pt-AO', { timeZone: 'Africa/Luanda', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    return `${fmt(s)} — ${fmt(new Date(e.getTime() - 1000))}`;
  }, [periodStart, periodEnd]);

  const barStep = points.length <= 14 ? 1 : points.length <= 31 ? 3 : points.length <= 92 ? 12 : 30;
  const barColor = selected === 'invoice' ? '#021f87' : '#1f9f6a';

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Evolução</p>
          <div className="flex flex-col gap-1">
            <p className="tabular-nums text-[34px] font-extrabold leading-none tracking-tight text-[var(--text)] sm:text-[42px]">{money(total)}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{monthLabel}</span>
              {selected === 'invoice' && (
                <span className="rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.08em]">Sem comparação válida</span>
              )}
            </div>
          </div>
        </div>
        <div role="tablist" aria-label="Dataset" className="inline-flex rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] p-1">
          <button role="tab" aria-selected={selected === 'invoice'} onClick={() => setSelected('invoice')} className={`min-h-9 rounded-[10px] px-4 text-xs font-semibold transition ${selected === 'invoice' ? 'bg-[#021f87] text-white shadow-[0_4px_12px_rgba(2,31,135,.3)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>Facturação</button>
          <button role="tab" aria-selected={selected === 'receipt'} onClick={() => setSelected('receipt')} className={`min-h-9 rounded-[10px] px-4 text-xs font-semibold transition ${selected === 'receipt' ? 'bg-[#021f87] text-white shadow-[0_4px_12px_rgba(2,31,135,.3)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>Recebimentos</button>
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2 border-b border-[var(--line)] pb-3 text-[11px] text-[var(--text-muted)]">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: barColor }} />
        <span className="font-semibold text-[var(--text)]">{label}</span>
        <span aria-hidden="true">·</span>
        <span>{monthLabel}</span>
      </div>

      {points.length ? (
        <svg viewBox="0 0 900 260" role="img" aria-label={`${label} ao longo do período seleccionado. Total: ${money(total)}`} className="h-[240px] w-full overflow-visible">
          <defs>
            <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={barColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={barColor} stopOpacity="0.85" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((ratio) => {
            const y = 200 - ratio * 184;
            return (
              <g key={ratio}>
                <line x1={64} x2={886} y1={y} y2={y} stroke="var(--line)" strokeDasharray={ratio === 0 ? undefined : '3 5'} />
                <text x={54} y={y + 4} textAnchor="end" className="fill-[var(--text-muted)] text-[11px]">{compact(max * ratio)}</text>
              </g>
            );
          })}
          {points.map((point, index) => {
            const barWidth = Math.max(8, Math.min(28, (886 - 64 - (points.length - 1) * 4) / points.length));
            const step = (886 - 64) / points.length;
            const x = 64 + index * step + (step - barWidth) / 2;
            const height = (point.value / max) * 184;
            const y = 200 - height;
            const radius = Math.min(4, barWidth / 3);
            return (
              <rect key={point.date} x={x} y={y} width={barWidth} height={height} rx={radius} ry={radius} fill={`url(#${id}-bar)`} className="transition-opacity hover:opacity-90">
                <title>{`${fullDate(point.date)} · ${money(point.value)}`}</title>
              </rect>
            );
          })}
          {points.map((point, index) => {
            if (index % barStep !== 0 && index !== points.length - 1) return null;
            const step = (886 - 64) / points.length;
            const barCenter = 64 + index * step + step / 2;
            return (
              <text key={point.date} x={barCenter} y={224} textAnchor="middle" className="fill-[var(--text-muted)] text-[11px]">{shortDate(point.date)}</text>
            );
          })}
        </svg>
      ) : (
        <div className="flex min-h-[240px] items-center justify-center rounded-[14px] border border-dashed border-[var(--line)] bg-[var(--surface-raised)] px-6 text-center text-sm text-[var(--text-muted)]">Sem movimentos neste período. Total real: {money(0)}</div>
      )}

      <button aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="mt-4 inline-flex items-center gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}><path d="M6 9l6 6 6-6"/></svg>
        {expanded ? 'Ocultar valores' : 'Consultar valores em tabela'}
      </button>
      {expanded && (
        <div className="mt-3 overflow-x-auto rounded-[14px] border border-[var(--line)]">
          <table className="w-full min-w-[420px] text-left text-xs">
            <caption className="sr-only">{label} por dia</caption>
            <thead><tr className="bg-[var(--surface-raised)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"><th className="px-3 py-2.5">Data</th><th className="px-3 py-2.5 text-right">Valor</th></tr></thead>
            <tbody>{points.map((p) => (
              <tr key={p.date} className="border-t border-[var(--line)]"><td className="px-3 py-2.5 text-[var(--text)]">{fullDate(p.date)}</td><td className="px-3 py-2.5 text-right tabular-nums text-[var(--text)]">{money(p.value)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
