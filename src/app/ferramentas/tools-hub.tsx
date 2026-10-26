'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CATEGORIAS_FERRAMENTAS, filtrarFerramentas } from '@/lib/business-tools';
import type { FerramentaCategoria, FerramentaResumo } from '@/lib/business-tools';
import { ToolIcon } from './tool-icon';

type FiltroCategoria = FerramentaCategoria | 'Todas';

const FILTROS: FiltroCategoria[] = ['Todas', ...CATEGORIAS_FERRAMENTAS];

export function ToolsHub({ ferramentas }: { ferramentas: FerramentaResumo[] }) {
  const [pesquisa, setPesquisa] = useState('');
  const [categoria, setCategoria] = useState<FiltroCategoria>('Todas');

  const visiveis = useMemo(
    () => filtrarFerramentas(ferramentas, pesquisa, categoria),
    [ferramentas, pesquisa, categoria],
  );

  return <div className="mt-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="w-full sm:max-w-xs">
        <label htmlFor="pesquisa-ferramenta" className="app-label">Pesquisar ferramenta</label>
        <input
          id="pesquisa-ferramenta"
          type="search"
          className="app-input"
          placeholder="Ex.: IVA, margem, NIF…"
          value={pesquisa}
          onChange={(event) => setPesquisa(event.target.value)}
        />
      </div>
      <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-2 sm:pb-0.5">
        {FILTROS.map((filtro) => (
          <button
            key={filtro}
            type="button"
            onClick={() => setCategoria(filtro)}
            aria-pressed={categoria === filtro}
            className={categoria === filtro
              ? 'rounded-full bg-[#102b46] px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]'
              : 'rounded-full border border-[#e2e9f1] bg-white px-4 py-2 text-sm font-semibold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]'}
          >
            {filtro}
          </button>
        ))}
      </div>
    </div>

    {visiveis.length === 0
      ? <div className="mt-10 rounded-2xl border border-dashed border-[#d5dfea] bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-[#1c2d3f]">Nenhuma ferramenta encontrada{pesquisa.trim() !== '' ? <> para «{pesquisa.trim()}»</> : null}.</p>
          <p className="mt-2 text-sm text-[#5b6f85]">Tente outro termo ou veja todas as categorias.</p>
          <button
            type="button"
            onClick={() => { setPesquisa(''); setCategoria('Todas'); }}
            className="mt-5 rounded-lg border border-[#c9def2] bg-white px-4 py-2 text-sm font-bold text-[#2878d0] transition hover:bg-[#f0f6fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]"
          >
            Limpar pesquisa
          </button>
        </div>
      : <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {visiveis.map((ferramenta) => (
            <li key={ferramenta.id} className="flex flex-col rounded-2xl border border-[#e2e9f1] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef6ff] text-[#2878d0]">
                  <ToolIcon icone={ferramenta.icone} className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-[#f3f6fa] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#708195]">
                  {ferramenta.categoria}
                </span>
              </div>
              <h2 className="mt-4 font-bold text-[#1c2d3f]">{ferramenta.nome}</h2>
              <p className="mt-1.5 text-sm leading-6 text-[#5b6f85]">{ferramenta.descricao}</p>
              <div className="mt-auto pt-4">
                {ferramenta.estado === 'ativa' && ferramenta.href !== null
                  ? <Link
                      href={ferramenta.href}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#2878d0] px-4 text-sm font-bold text-white transition hover:bg-[#216bbd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]"
                    >
                      Abrir ferramenta
                    </Link>
                  : <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#708195]" title="Esta ferramenta está em desenvolvimento">
                      <span className="rounded-full border border-[#e2e9f1] bg-[#f3f6fa] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">Em breve</span>
                      Em desenvolvimento
                    </span>}
              </div>
            </li>
          ))}
        </ul>}
  </div>;
}
