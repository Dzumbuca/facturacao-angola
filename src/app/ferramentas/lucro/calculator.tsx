'use client';

import { useState } from 'react';
import { calcularLucro, formatKz, formatPercent, parseValor } from '@/lib/business-tools';

// Leitura de campo: vazio → 0 (campos opcionais); inválido ou negativo → NaN.
function lerCampo(valor: string, obrigatorio: boolean): number {
  if (valor.trim() === '') return obrigatorio ? Number.NaN : 0;
  return parseValor(valor);
}

const ERRO_CAMPO = 'Introduza um valor numérico igual ou superior a zero.';

export function LucroCalculator() {
  const [nome, setNome] = useState('');
  const [custoAquisicao, setCustoAquisicao] = useState('');
  const [outrosCustos, setOutrosCustos] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [quantidade, setQuantidade] = useState('');

  const custo = lerCampo(custoAquisicao, true);
  const outros = lerCampo(outrosCustos, false);
  const preco = lerCampo(precoVenda, true);
  const quantidadeLida = lerCampo(quantidade, false);

  const erroCusto = Number.isNaN(custo) || custo < 0;
  const erroOutros = Number.isNaN(outros) || outros < 0;
  const erroPreco = Number.isNaN(preco) || preco < 0;
  const erroQuantidade = Number.isNaN(quantidadeLida) || quantidadeLida < 0;

  const camposValidos = !erroCusto && !erroOutros && !erroPreco && !erroQuantidade;
  const formularioPreenchido = custoAquisicao.trim() !== '' && precoVenda.trim() !== '';

  const resultado = camposValidos && formularioPreenchido
    ? calcularLucro({ custoAquisicao: custo, outrosCustos: outros, precoVenda: preco, quantidade: quantidadeLida })
    : null;

  const limpar = () => { setNome(''); setCustoAquisicao(''); setOutrosCustos(''); setPrecoVenda(''); setQuantidade(''); };

  return <div className="space-y-5">
    <div>
      <label htmlFor="lucro-nome" className="app-label">Nome do produto ou serviço (opcional)</label>
      <input id="lucro-nome" className="app-input" placeholder="Ex.: Sacos de arroz 25 kg" value={nome} onChange={(event) => setNome(event.target.value)} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="lucro-custo" className="app-label">Custo de aquisição (Kz) <span className="text-[#c44747]">*</span></label>
        <input id="lucro-custo" inputMode="decimal" className="app-input tabular-nums" placeholder="Ex.: 500" value={custoAquisicao} onChange={(event) => setCustoAquisicao(event.target.value)} aria-invalid={erroCusto || undefined} />
        {erroCusto && custoAquisicao.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_CAMPO}</p>}
      </div>
      <div>
        <label htmlFor="lucro-outros" className="app-label">Outros custos por unidade (Kz) — opcional</label>
        <input id="lucro-outros" inputMode="decimal" className="app-input tabular-nums" placeholder="Ex.: 100 (transporte, embalagem…)" value={outrosCustos} onChange={(event) => setOutrosCustos(event.target.value)} aria-invalid={erroOutros || undefined} />
        {erroOutros && outrosCustos.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_CAMPO}</p>}
      </div>
      <div>
        <label htmlFor="lucro-preco" className="app-label">Preço de venda (Kz) <span className="text-[#c44747]">*</span></label>
        <input id="lucro-preco" inputMode="decimal" className="app-input tabular-nums" placeholder="Ex.: 1000" value={precoVenda} onChange={(event) => setPrecoVenda(event.target.value)} aria-invalid={erroPreco || undefined} />
        {erroPreco && precoVenda.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_CAMPO}</p>}
      </div>
      <div>
        <label htmlFor="lucro-quantidade" className="app-label">Quantidade vendida — opcional</label>
        <input id="lucro-quantidade" inputMode="numeric" className="app-input tabular-nums" placeholder="Ex.: 10" value={quantidade} onChange={(event) => setQuantidade(event.target.value)} aria-invalid={erroQuantidade || undefined} />
        {erroQuantidade && quantidade.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_CAMPO}</p>}
      </div>
    </div>

    {!resultado && <p className="rounded-xl bg-[#f7f9fc] p-4 text-center text-sm text-[#708195]">Introduza o custo e o preço de venda para ver o resultado.</p>}

    {resultado && <>
      {resultado.prejuizo && <p role="alert" className="rounded-xl border border-[#f0d3d3] bg-[#fdf2f2] p-4 text-sm font-semibold text-[#a13d3d]">
        ⚠ Prejuízo: {nome.trim() !== '' ? `«${nome.trim()}» ` : ''}está a ser vendido abaixo do custo total. Suba o preço de venda ou reduza custos.
      </p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Custo total unitário</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{formatKz(resultado.custoTotalUnitario)}</p>
        </div>
        <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Preço de venda</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{formatKz(preco)}</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${resultado.prejuizo ? 'border-[#f0d3d3] bg-[#fdf2f2]' : 'border-[#cbe8dc] bg-[#eff9f4]'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">{resultado.prejuizo ? 'Prejuízo unitário' : 'Lucro unitário'}</p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${resultado.prejuizo ? 'text-[#a13d3d]' : 'text-[#227958]'}`}>{formatKz(resultado.lucroUnitario)}</p>
        </div>
        <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">Margem de lucro</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#2878d0]">{formatPercent(resultado.margemPercent)}</p>
          <p className="mt-1 text-xs text-[#708195]">sobre o preço de venda</p>
        </div>
        <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">Markup</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#2878d0]">{formatPercent(resultado.markupPercent)}</p>
          <p className="mt-1 text-xs text-[#708195]">sobre o custo total</p>
        </div>
        {resultado.lucroTotal !== null && <div className={`rounded-xl border p-4 text-center ${resultado.prejuizo ? 'border-[#f0d3d3] bg-[#fdf2f2]' : 'border-[#cbe8dc] bg-[#eff9f4]'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">{resultado.prejuizo ? 'Prejuízo total' : 'Lucro total'}</p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${resultado.prejuizo ? 'text-[#a13d3d]' : 'text-[#227958]'}`}>{formatKz(resultado.lucroTotal)}</p>
          <p className="mt-1 text-xs text-[#708195]">{`${quantidade.replace('.', ',')} unidades`}</p>
        </div>}
      </div>

      <p className="rounded-xl bg-[#f7f9fc] p-4 text-sm leading-6 text-[#46586c]">
        <strong className="text-[#1c2d3f]">Em palavras simples:</strong> cada unidade {nome.trim() !== '' ? `de «${nome.trim()}» ` : ''}custa-lhe <strong className="tabular-nums">{formatKz(resultado.custoTotalUnitario)}</strong> (compra + outros custos) e é vendida por <strong className="tabular-nums">{formatKz(preco)}</strong>. Fica com <strong className="tabular-nums">{formatKz(resultado.lucroUnitario)}</strong> por unidade — {formatPercent(resultado.margemPercent)} do preço de venda.{resultado.lucroTotal !== null ? ` Vendendo ${quantidade.replace('.', ',')} unidades, o resultado total é ${formatKz(resultado.lucroTotal)}.` : ''}
      </p>
    </>}

    <div className="flex justify-end">
      <button type="button" onClick={limpar} className="rounded-lg border border-[#d5dfea] bg-white px-4 py-2 text-sm font-bold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">
        Limpar campos
      </button>
    </div>
  </div>;
}
