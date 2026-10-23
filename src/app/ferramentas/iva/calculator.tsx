'use client';

import { useState } from 'react';

const kz = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(Number.isFinite(value) ? value : 0);

export function IvaCalculator() {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('14');

  const base = Number(amount.replace(',', '.')) || 0;
  const rateValue = Number(rate.replace(',', '.')) || 0;
  const valid = base > 0 && rateValue >= 0 && rateValue <= 100;

  const withoutIva = mode === 'add' ? base : base / (1 + rateValue / 100);
  const iva = mode === 'add' ? base * (rateValue / 100) : base - withoutIva;
  const total = mode === 'add' ? base : base;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="iva-mode" className="app-label">O valor que tens já inclui IVA?</label>
        <select id="iva-mode" className="app-input" value={mode} onChange={(event) => setMode(event.target.value as 'add' | 'remove')}>
          <option value="add">Não — quero acrescentar o IVA</option>
          <option value="remove">Sim — quero retirar o IVA</option>
        </select>
      </div>
      <div>
        <label htmlFor="iva-rate" className="app-label">Taxa de IVA</label>
        <select id="iva-rate" className="app-input" value={rate} onChange={(event) => setRate(event.target.value)}>
          <option value="14">14% — taxa geral (Angola)</option>
          <option value="7">7% — taxa reduzida</option>
          <option value="2">2% — taxa especial</option>
          <option value="0">0% — isento</option>
        </select>
      </div>
    </div>
    <div>
      <label htmlFor="iva-amount" className="app-label">Valor {mode === 'add' ? 'sem IVA' : 'com IVA'} (Kz) <span className="text-[#c44747]">*</span></label>
      <input id="iva-amount" inputMode="decimal" className="app-input tabular-nums text-lg" placeholder="Ex.: 100000" value={amount} onChange={(event) => setAmount(event.target.value)} />
    </div>

    {valid ? <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Sem IVA</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{kz(withoutIva)}</p>
      </div>
      <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">IVA ({rateValue}%)</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#2878d0]">{kz(iva)}</p>
      </div>
      <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Total com IVA</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#227958]">{kz(mode === 'add' ? total + iva : total)}</p>
      </div>
    </div> : <p className="rounded-xl bg-[#f7f9fc] p-4 text-center text-sm text-[#708195]">Introduz um valor para calcular.</p>}
  </div>;
}
