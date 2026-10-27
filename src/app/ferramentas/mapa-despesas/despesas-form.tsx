'use client';

import { useState } from 'react';
import { formatKz, parseValor } from '@/lib/business-tools';
import { totaisDespesasPorCategoria } from '@/lib/business-docs';
import { Campo, ERRO_TEXTO, useDescarregarPdf } from '../doc-forms';

type LinhaDespesa = { data: string; descricao: string; categoria: string; valor: string };

const LINHA_VAZIA: LinhaDespesa = { data: '', descricao: '', categoria: '', valor: '' };

export function DespesasForm() {
  const { estado, erro, descarregar } = useDescarregarPdf();
  const [periodoDe, setPeriodoDe] = useState('');
  const [periodoAte, setPeriodoAte] = useState('');
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaNif, setEmpresaNif] = useState('');
  const [empresaContacto, setEmpresaContacto] = useState('');
  const [linhas, setLinhas] = useState<LinhaDespesa[]>([{ ...LINHA_VAZIA }]);

  const linhasNumericas = linhas.map((linha) => ({
    data: linha.data,
    descricao: linha.descricao.trim(),
    categoria: linha.categoria.trim() || 'Outras',
    valor: parseValor(linha.valor),
  }));
  const total = linhasNumericas.reduce((soma, linha) => soma + (Number.isFinite(linha.valor) && linha.valor > 0 ? linha.valor : 0), 0);
  const grupos = totaisDespesasPorCategoria(
    linhasNumericas
      .filter((linha) => Number.isFinite(linha.valor) && linha.valor > 0 && linha.descricao !== '')
      .map((linha) => ({ ...linha, valor: linha.valor as number })),
  );

  const erros = {
    empresaNome: empresaNome.trim() === '' ? ERRO_TEXTO : null,
    linhas: linhasNumericas.some((linha) => linha.descricao === '') ? 'Cada despesa precisa de descrição.'
      : linhasNumericas.some((linha) => !Number.isFinite(linha.valor) || linha.valor <= 0) ? 'Cada despesa precisa de valor maior que zero.'
      : null,
  };
  const valido = !erros.empresaNome && !erros.linhas;

  const atualizarLinha = (indice: number, campo: keyof LinhaDespesa, valorLinha: string) => {
    setLinhas((actuais) => actuais.map((linha, i) => (i === indice ? { ...linha, [campo]: valorLinha } : linha)));
  };

  const limpar = () => {
    setPeriodoDe(''); setPeriodoAte(''); setEmpresaNome(''); setEmpresaNif(''); setEmpresaContacto('');
    setLinhas([{ ...LINHA_VAZIA }]);
  };

  const submeter = async () => {
    if (!valido) return;
    await descarregar({
      tipo: 'despesas',
      empresa: { nome: empresaNome.trim(), nif: empresaNif.trim() || undefined, contacto: empresaContacto.trim() || undefined },
      periodoDe: periodoDe || undefined,
      periodoAte: periodoAte || undefined,
      linhas: linhasNumericas.map((linha) => ({ data: linha.data || undefined, descricao: linha.descricao, categoria: linha.categoria, valor: linha.valor })),
    }, { tipo: 'despesas' });
  };

  return <div className="app-calculator space-y-5">
    <fieldset className="rounded-xl border border-[#e2e9f1] p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-[.12em] text-[#708195]">A sua empresa</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="desp-emp-nome" label="Nome" obrigatorio erro={empresaNome.trim() !== '' && erros.empresaNome ? erros.empresaNome : null}>
          <input id="desp-emp-nome" className="app-input" placeholder="Ex.: Comércio Kiala Lda" value={empresaNome} onChange={(event) => setEmpresaNome(event.target.value)} />
        </Campo>
        <Campo id="desp-emp-nif" label="NIF (opcional)">
          <input id="desp-emp-nif" className="app-input" value={empresaNif} onChange={(event) => setEmpresaNif(event.target.value)} />
        </Campo>
        <Campo id="desp-emp-contacto" label="Contacto (opcional)">
          <input id="desp-emp-contacto" className="app-input" value={empresaContacto} onChange={(event) => setEmpresaContacto(event.target.value)} />
        </Campo>
      </div>
    </fieldset>

    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id="desp-periodo-de" label="Período — de (opcional)">
        <input id="desp-periodo-de" type="date" className="app-input" value={periodoDe} onChange={(event) => setPeriodoDe(event.target.value)} />
      </Campo>
      <Campo id="desp-periodo-ate" label="Período — até (opcional)">
        <input id="desp-periodo-ate" type="date" className="app-input" value={periodoAte} onChange={(event) => setPeriodoAte(event.target.value)} />
      </Campo>
    </div>

    <div>
      <div className="flex items-center justify-between">
        <span className="app-label mb-0">Despesas <span className="text-[#c44747]">*</span></span>
        <button type="button" onClick={() => setLinhas((actuais) => [...actuais, { ...LINHA_VAZIA }])} className="rounded-lg border border-[#c9def2] bg-white px-3 py-1.5 text-xs font-bold text-[#2878d0] transition hover:bg-[#f0f6fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">
          + Adicionar despesa
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {linhas.map((linha, indice) => <div key={indice} className="grid grid-cols-[92px_1fr_88px_32px] items-start gap-2 sm:grid-cols-[110px_1fr_130px_96px_32px]">
          <input aria-label={`Data da despesa ${indice + 1}`} type="date" className="app-input tabular-nums" value={linha.data} onChange={(event) => atualizarLinha(indice, 'data', event.target.value)} />
          <input aria-label={`Descrição da despesa ${indice + 1}`} className="app-input" placeholder={`Despesa ${indice + 1} — descrição`} value={linha.descricao} onChange={(event) => atualizarLinha(indice, 'descricao', event.target.value)} />
          <input aria-label={`Categoria da despesa ${indice + 1}`} className="app-input" placeholder="Categoria" value={linha.categoria} onChange={(event) => atualizarLinha(indice, 'categoria', event.target.value)} />
          <input aria-label={`Valor da despesa ${indice + 1}`} inputMode="decimal" className="app-input tabular-nums" placeholder="Kz" value={linha.valor} onChange={(event) => atualizarLinha(indice, 'valor', event.target.value)} />
          <button type="button" aria-label={`Remover despesa ${indice + 1}`} disabled={linhas.length === 1} onClick={() => setLinhas((actuais) => actuais.filter((_, i) => i !== indice))} className="mt-1 rounded-lg px-2 py-1.5 text-sm font-bold text-[#a13d3d] transition hover:bg-[#fdf2f2] disabled:opacity-30">✕</button>
        </div>)}
      </div>
      {erros.linhas && <p className="mt-1 text-xs font-semibold text-[#c44747]">{erros.linhas}</p>}
    </div>

    {total > 0 && <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-center sm:col-span-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Total do período</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#227958]">{formatKz(total)}</p>
      </div>
      <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 sm:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Por categoria</p>
        <ul className="mt-1 space-y-1 text-sm tabular-nums">
          {grupos.map((grupo) => <li key={grupo.categoria} className="flex justify-between gap-3"><span className="text-[#5b6f85]">{grupo.categoria}</span><span className="font-bold text-[#1c2d3f]">{formatKz(grupo.total)}</span></li>)}
        </ul>
      </div>
    </div>}

    {erro && <p role="alert" className="rounded-xl border border-[#f0d3d3] bg-[#fdf2f2] p-4 text-sm font-semibold text-[#a13d3d]">{erro}</p>}
    {estado === 'ok' && <p role="status" className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-sm font-semibold text-[#227958]">PDF gerado e descarregado ✓</p>}

    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={limpar} className="rounded-lg border border-[#d5dfea] bg-white px-4 py-2 text-sm font-bold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0]">Limpar</button>
      <button type="button" onClick={submeter} disabled={!valido || estado === 'a-gerar'} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">
        {estado === 'a-gerar' ? 'A gerar PDF…' : 'Descarregar PDF'}
      </button>
    </div>
  </div>;
}
