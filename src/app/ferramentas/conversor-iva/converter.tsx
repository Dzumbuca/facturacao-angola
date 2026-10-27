'use client';

import { useState } from 'react';
import { converterIva, formatKz, IVA_TAXAS, parseValor } from '@/lib/business-tools';
import type { ModoIva } from '@/lib/business-tools';

export function ConversorIva() {
  const [modo, setModo] = useState<ModoIva>('acrescentar');
  const [valor, setValor] = useState('');
  const [taxa, setTaxa] = useState('14');

  const valorLido = parseValor(valor);
  const taxaValor = Number(taxa) || 0;
  const valido = Number.isFinite(valorLido) && valorLido >= 0 && taxaValor >= 0 && taxaValor <= 100;

  const resultado = valido ? converterIva(valorLido, taxaValor, modo) : null;

  return <div className="app-calculator space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <span className="app-label" id="conversor-modo-label">Modo de conversão</span>
        <div role="group" aria-labelledby="conversor-modo-label" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModo('acrescentar')}
            aria-pressed={modo === 'acrescentar'}
            className={modo === 'acrescentar'
              ? 'rounded-lg bg-[#102b46] px-3 py-2.5 text-sm font-bold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]'
              : 'rounded-lg border border-[#e2e9f1] bg-white px-3 py-2.5 text-sm font-semibold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]'}
          >
            A — Adicionar IVA
          </button>
          <button
            type="button"
            onClick={() => setModo('retirar')}
            aria-pressed={modo === 'retirar'}
            className={modo === 'retirar'
              ? 'rounded-lg bg-[#102b46] px-3 py-2.5 text-sm font-bold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]'
              : 'rounded-lg border border-[#e2e9f1] bg-white px-3 py-2.5 text-sm font-semibold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]'}
          >
            B — Retirar IVA
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="conversor-taxa" className="app-label">Taxa de IVA</label>
        <select id="conversor-taxa" className="app-input" value={taxa} onChange={(event) => setTaxa(event.target.value)}>
          {IVA_TAXAS.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>{opcao.etiqueta}</option>
          ))}
        </select>
      </div>
    </div>

    <div>
      <label htmlFor="conversor-valor" className="app-label">
        {modo === 'acrescentar' ? 'Valor sem IVA (Kz)' : 'Valor total com IVA incluído (Kz)'} <span className="text-[#c44747]">*</span>
      </label>
      <input
        id="conversor-valor"
        inputMode="decimal"
        className="app-input tabular-nums text-lg"
        placeholder={modo === 'acrescentar' ? 'Ex.: 100000' : 'Ex.: 114000'}
        value={valor}
        onChange={(event) => setValor(event.target.value)}
        aria-invalid={valor.trim() !== '' && (Number.isNaN(valorLido) || valorLido < 0) || undefined}
      />
      {valor.trim() !== '' && (Number.isNaN(valorLido) || valorLido < 0) && <p className="mt-1 text-xs font-semibold text-[#c44747]">Introduza um valor numérico igual ou superior a zero.</p>}
    </div>

    {!resultado && <p className="rounded-xl bg-[#f7f9fc] p-4 text-center text-sm text-[#708195]">
      {modo === 'acrescentar' ? 'Introduza o valor sem IVA para acrescentar a taxa escolhida.' : 'Introduza o valor total para retirar a taxa escolhida.'}
    </p>}

    {resultado && <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Sem IVA</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{formatKz(resultado.valorSemIva)}</p>
      </div>
      <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">{modo === 'acrescentar' ? `IVA a acrescentar (${taxaValor}%)` : `IVA incluído no total (${taxaValor}%)`}</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#2878d0]">{formatKz(resultado.iva)}</p>
      </div>
      <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Total com IVA</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#227958]">{formatKz(resultado.totalComIva)}</p>
      </div>
    </div>}

    {resultado && <p className="sr-only" aria-live="polite">{`Sem IVA ${formatKz(resultado.valorSemIva)}, IVA ${formatKz(resultado.iva)}, total com IVA ${formatKz(resultado.totalComIva)}.`}</p>}

    <div className="flex justify-end">
      <button type="button" onClick={() => { setValor(''); setTaxa('14'); }} className="rounded-lg border border-[#d5dfea] bg-white px-4 py-2 text-sm font-bold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">
        Limpar campos
      </button>
    </div>
  </div>;
}
