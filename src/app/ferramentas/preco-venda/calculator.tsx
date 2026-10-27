'use client';

import { useState } from 'react';
import { calcularPrecoVenda, formatKz, formatPercent, parseValor } from '@/lib/business-tools';

function lerCampo(valor: string, obrigatorio: boolean): number {
  if (valor.trim() === '') return obrigatorio ? Number.NaN : 0;
  return parseValor(valor);
}

const ERRO_CAMPO = 'Introduza um valor numérico igual ou superior a zero.';
const ERRO_MARGEM = 'A margem deve estar entre 0% e 99,9%.';

export function PrecoVendaCalculator() {
  const [custoAquisicao, setCustoAquisicao] = useState('');
  const [outrosCustos, setOutrosCustos] = useState('');
  const [margemPretendida, setMargemPretendida] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [arredondamento, setArredondamento] = useState('0');

  const custo = lerCampo(custoAquisicao, true);
  const outros = lerCampo(outrosCustos, false);
  const margem = lerCampo(margemPretendida, true);
  const quantidadeLida = lerCampo(quantidade, false);
  const incremento = Number(arredondamento) || 0;

  const erroCusto = Number.isNaN(custo) || custo < 0;
  const erroOutros = Number.isNaN(outros) || outros < 0;
  const erroMargem = Number.isNaN(margem) || margem < 0 || margem >= 100;
  const erroQuantidade = Number.isNaN(quantidadeLida) || quantidadeLida < 0;

  const camposValidos = !erroCusto && !erroOutros && !erroMargem && !erroQuantidade;
  const formularioPreenchido = custoAquisicao.trim() !== '' && margemPretendida.trim() !== '';

  const resultado = camposValidos && formularioPreenchido
    ? calcularPrecoVenda({ custoAquisicao: custo, outrosCustos: outros, margemPretendida: margem, quantidade: quantidadeLida, arredondamento: incremento })
    : null;

  const limpar = () => { setCustoAquisicao(''); setOutrosCustos(''); setMargemPretendida(''); setQuantidade(''); setArredondamento('0'); };

  return <div className="app-calculator space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="preco-custo" className="app-label">Custo de aquisição (Kz) <span className="text-[#c44747]">*</span></label>
        <input id="preco-custo" inputMode="decimal" className="app-input tabular-nums" placeholder="Ex.: 500" value={custoAquisicao} onChange={(event) => setCustoAquisicao(event.target.value)} aria-invalid={custoAquisicao.trim() !== '' && erroCusto ? true : undefined} />
        {erroCusto && custoAquisicao.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_CAMPO}</p>}
      </div>
      <div>
        <label htmlFor="preco-outros" className="app-label">Outros custos por unidade (Kz) — opcional</label>
        <input id="preco-outros" inputMode="decimal" className="app-input tabular-nums" placeholder="Ex.: 100 (transporte, embalagem…)" value={outrosCustos} onChange={(event) => setOutrosCustos(event.target.value)} aria-invalid={outrosCustos.trim() !== '' && erroOutros ? true : undefined} />
        {erroOutros && outrosCustos.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_CAMPO}</p>}
      </div>
      <div>
        <label htmlFor="preco-margem" className="app-label">Margem de lucro pretendida (%) <span className="text-[#c44747]">*</span></label>
        <input id="preco-margem" inputMode="decimal" className="app-input tabular-nums" placeholder="Ex.: 25" value={margemPretendida} onChange={(event) => setMargemPretendida(event.target.value)} aria-invalid={margemPretendida.trim() !== '' && erroMargem ? true : undefined} />
        {erroMargem && margemPretendida.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_MARGEM}</p>}
      </div>
      <div>
        <label htmlFor="preco-quantidade" className="app-label">Quantidade — opcional</label>
        <input id="preco-quantidade" inputMode="numeric" className="app-input tabular-nums" placeholder="Ex.: 10" value={quantidade} onChange={(event) => setQuantidade(event.target.value)} aria-invalid={quantidade.trim() !== '' && erroQuantidade ? true : undefined} />
        {erroQuantidade && quantidade.trim() !== '' && <p className="mt-1 text-xs font-semibold text-[#c44747]">{ERRO_CAMPO}</p>}
      </div>
    </div>

    <div>
      <label htmlFor="preco-arredondamento" className="app-label">Arredondamento comercial (opcional)</label>
      <select id="preco-arredondamento" className="app-input" value={arredondamento} onChange={(event) => setArredondamento(event.target.value)}>
        <option value="0">Não arredondar — mostrar o valor exacto</option>
        <option value="5">Arredondar para cima até 5 Kz</option>
        <option value="10">Arredondar para cima até 10 Kz</option>
        <option value="25">Arredondar para cima até 25 Kz</option>
        <option value="50">Arredondar para cima até 50 Kz</option>
        <option value="100">Arredondar para cima até 100 Kz</option>
      </select>
    </div>

    {!resultado && <p className="rounded-xl bg-[#f7f9fc] p-4 text-center text-sm text-[#708195]">Introduza o custo e a margem pretendida para ver o preço recomendado.</p>}

    {resultado && resultado.precoAjustado !== null && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Custo total unitário</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{formatKz(resultado.custoTotalUnitario)}</p>
        </div>
        <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Margem pretendida</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{formatPercent(margem)}</p>
        </div>
        <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">Preço recomendado</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#2878d0]">{formatKz(resultado.precoAjustado)}</p>
          {incremento > 0 && resultado.precoAjustado !== null && resultado.precoRecomendado !== null && resultado.precoAjustado !== resultado.precoRecomendado && (
            <p className="mt-1 text-xs text-[#708195]">calculado: {formatKz(resultado.precoRecomendado)}</p>
          )}
        </div>
        <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Lucro estimado por unidade</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#227958]">{formatKz(resultado.lucroUnitario ?? 0)}</p>
        </div>
        {resultado.lucroTotal !== null && <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Lucro estimado total</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#227958]">{formatKz(resultado.lucroTotal)}</p>
          <p className="mt-1 text-xs text-[#708195]">{`${quantidade.replace('.', ',')} unidades`}</p>
        </div>}
        {incremento > 0 && <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Margem efectiva com o preço ajustado</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{formatPercent(resultado.margemEfetivaPercent)}</p>
        </div>}
      </div>

      {resultado && <p className="sr-only" aria-live="polite">{`Preço recomendado ${formatKz(resultado.precoAjustado ?? 0)}, lucro estimado por unidade ${formatKz(resultado.lucroUnitario ?? 0)}.`}</p>}
      <p className="rounded-xl bg-[#f7f9fc] p-4 text-sm leading-6 text-[#46586c]">
        <strong className="text-[#1c2d3f]">Nota:</strong> o preço recomendado é uma simulação baseada nos custos e na margem que introduziu — não é uma garantia de rentabilidade. Compare sempre com os preços do mercado antes de decidir.
      </p>
    </>}

    <div className="flex justify-end">
      <button type="button" onClick={limpar} className="rounded-lg border border-[#d5dfea] bg-white px-4 py-2 text-sm font-bold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">
        Limpar campos
      </button>
    </div>
  </div>;
}
