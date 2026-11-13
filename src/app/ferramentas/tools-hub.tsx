'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CATEGORIAS_FERRAMENTAS, filtrarFerramentas } from '@/lib/business-tools';
import type { FerramentaResumo, FerramentaCategoria } from '@/lib/business-tools';
import { ToolIcon } from './tool-icon';

type FiltroCategoria = FerramentaCategoria | 'Todas';
const FILTROS: FiltroCategoria[] = ['Todas', ...CATEGORIAS_FERRAMENTAS];

const categoryStyle: Record<string, { iconBg: string; iconColor: string; badge: string }> = {
  'Fiscalidade': { iconBg: 'bg-[#eef2ff] dark:bg-[#0d1730]', iconColor: 'text-[#021f87] dark:text-[#8aa4ff]', badge: 'bg-[#eef2ff] text-[#021f87] dark:bg-[#0d1730] dark:text-[#8aa4ff]' },
  'Gestão Financeira': { iconBg: 'bg-[#eff9f4] dark:bg-[#0e241b]', iconColor: 'text-[#267256] dark:text-[#34d399]', badge: 'bg-[#eff9f4] text-[#227958] dark:bg-[#0e241b] dark:text-[#34d399]' },
  'Documentos Empresariais': { iconBg: 'bg-[#f3effc] dark:bg-[#1a1235]', iconColor: 'text-[#5b34d6] dark:text-[#c4b0ff]', badge: 'bg-[#f3effc] text-[#5b34d6] dark:bg-[#1a1235] dark:text-[#c4b0ff]' },
};

export function ToolsHub({ ferramentas }: { ferramentas: FerramentaResumo[] }) {
  const [pesquisa, setPesquisa] = useState('');
  const [categoria, setCategoria] = useState<FiltroCategoria>('Todas');

  const visiveis = useMemo(
    () => filtrarFerramentas(ferramentas, pesquisa, categoria),
    [ferramentas, pesquisa, categoria],
  );

  const total = ferramentas.length;
  const ativas = ferramentas.filter((f) => f.estado === 'ativa').length;
  const emBreve = total - ativas;

  return (
    <div className="mt-6 space-y-7">
      {/* Indicadores calculados a partir dos dados reais */}
      <section aria-label="Indicadores do catálogo" className="grid grid-cols-3 gap-2">
        {([
          { label: 'Total', value: total, sub: 'ferramentas' },
          { label: 'Disponíveis', value: ativas, sub: 'em funcionamento' },
          { label: 'Em desenvolvimento', value: emBreve, sub: 'próximamente' },
        ]).map((item) => (
          <div key={item.label} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-3 text-center sm:px-4">
            <p className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">{item.label}</p>
            <p className="tabular-nums mt-0.5 text-xl font-extrabold text-[var(--text)] sm:text-2xl">{item.value}</p>
            <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{item.sub}</p>
          </div>
        ))}
      </section>

      {/* Search + filtros */}
      <section aria-label="Pesquisa e filtros" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="relative block sm:min-w-[260px] lg:min-w-[320px]">
          <span className="sr-only">Pesquisar ferramenta</span>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            id="pesquisa-ferramenta"
            type="text"
            className="app-input pl-11 pr-10"
            placeholder="Ex.: IVA, margem, NIF..."
            value={pesquisa}
            onChange={(event) => setPesquisa(event.target.value)}
            autoComplete="off"
            spellCheck="false"
            aria-label="Pesquisar ferramenta"
          />
          {pesquisa && (
            <button onClick={() => setPesquisa('')} type="button" aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--text)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          )}
        </label>
        <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-1.5 max-w-full overflow-x-hidden">
          {FILTROS.map((filtro) => {
            const active = categoria === filtro;
            return (
              <button key={filtro} type="button" onClick={() => setCategoria(filtro)} aria-pressed={active} className={`min-h-9 rounded-full border px-4 text-[12px] font-semibold transition ${active ? 'border-transparent bg-[#021f87] text-white shadow-[0_6px_14px_rgba(2,31,135,.30)]' : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text)] hover:border-[#021f87] hover:text-[#021f87]'}`}>{filtro}</button>
            );
          })}
        </div>
      </section>

      {/* Cards */}
      {visiveis.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[var(--line)] bg-[var(--surface-raised)] px-6 py-10 text-center">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-[var(--text-muted)]"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <p className="mt-2 text-sm font-bold text-[var(--text)]">Nenhuma ferramenta encontrada</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Experimenta outro termo ou vê todas as categorias.</p>
          <button type="button" onClick={() => { setPesquisa(''); setCategoria('Todas'); }} className="mt-3 inline-flex min-h-10 items-center rounded-[12px] border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--blue)] hover:border-[var(--blue)]">Limpar pesquisa e filtros</button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {visiveis.map((ferramenta) => {
            const cat = categoryStyle[ferramenta.categoria] ?? categoryStyle['Fiscalidade']!;
            const ready = ferramenta.estado === 'ativa' && ferramenta.href;
            return (
              <li key={ferramenta.id} className="group flex h-full flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-[1px] hover:border-[var(--blue)]">
                <div className="flex items-start justify-between gap-2">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[14px] ring-1 ring-[var(--line)] ${cat.iconBg} ${cat.iconColor}`}>
                    <ToolIcon icone={ferramenta.icone} className="h-6 w-6" />
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.11em] ${cat.badge}`}>{ferramenta.categoria}</span>
                </div>
                <h3 className="mt-4 text-[17px] font-extrabold text-[var(--text)]">{ferramenta.nome}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-[var(--text-muted)]">{ferramenta.descricao}</p>
                <div className="mt-auto pt-5">
                  {ready ? (
                    <Link href={ferramenta.href as string} className="inline-flex min-h-12 w-full items-center justify-center rounded-[12px] bg-[#021f87] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0634b8]">Abrir ferramenta →</Link>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]" title="Esta ferramenta está em desenvolvimento">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                      Em breve
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
