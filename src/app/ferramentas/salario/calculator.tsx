'use client';

import { useState } from 'react';

// Tabela do IRT — rendimento do trabalho (mensal, Kz), em vigor desde Janeiro de 2024.
// Estrutura: até (limite superior do escalão), taxa marginal, parcela a abater.
const IRT_TABLE = [
  { max: 100_000, rate: 0, deduct: 0, label: 'Até 100.000 Kz' },
  { max: 150_000, rate: 0.13, deduct: 13_000, label: '100.001 – 150.000 Kz' },
  { max: 200_000, rate: 0.16, deduct: 17_500, label: '150.001 – 200.000 Kz' },
  { max: 300_000, rate: 0.18, deduct: 21_500, label: '200.001 – 300.000 Kz' },
  { max: 500_000, rate: 0.19, deduct: 24_500, label: '300.001 – 500.000 Kz' },
  { max: 1_000_000, rate: 0.20, deduct: 29_500, label: '500.001 – 1.000.000 Kz' },
  { max: 1_500_000, rate: 0.21, deduct: 39_500, label: '1.000.001 – 1.500.000 Kz' },
  { max: Infinity, rate: 0.22, deduct: 54_500, label: 'Mais de 1.500.000 Kz' },
];

const INSS_RATE = 0.03; // contribuição do trabalhador para o INSS

const kz = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(Number.isFinite(value) ? value : 0);

export function SalaryCalculator() {
  const [gross, setGross] = useState('');

  const grossValue = Number(gross.replace(/\s/g, '').replace(',', '.')) || 0;
  const valid = grossValue > 0;
  const inss = grossValue * INSS_RATE;
  const taxable = Math.max(0, grossValue - inss);
  const bracket = IRT_TABLE.find((step) => taxable <= step.max) ?? IRT_TABLE[IRT_TABLE.length - 1];
  const irt = valid ? Math.max(0, taxable * bracket.rate - bracket.deduct) : 0;
  const net = grossValue - inss - irt;

  return <div className="space-y-5">
    <div>
      <label htmlFor="salary-gross" className="app-label">Salário bruto mensal (Kz) <span className="text-[#c44747]">*</span></label>
      <input id="salary-gross" inputMode="decimal" className="app-input tabular-nums text-lg" placeholder="Ex.: 350000" value={gross} onChange={(event) => setGross(event.target.value)} />
      <p className="mt-1.5 text-xs text-[#708195]">O valor antes de quaisquer descontos.</p>
    </div>

    {valid ? <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-[#e2e9f1] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">INSS (3% do trabalhador)</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">− {kz(inss)}</p>
      </div>
      <div className="rounded-xl border border-[#e2e9f1] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Rendimento tributável</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{kz(taxable)}</p>
      </div>
      <div className="rounded-xl border border-[#f0d9c9] bg-[#fdf5ef] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#b16d15]">IRT (escalão {bracket.label})</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#b16d15]">− {kz(irt)}</p>
      </div>
      <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Salário líquido</p>
        <p className="mt-1 text-xl font-black tabular-nums text-[#227958]">{kz(net)}</p>
      </div>
    </div> : <p className="rounded-xl bg-[#f7f9fc] p-4 text-center text-sm text-[#708195]">Introduz o salário bruto para calcular.</p>}

    <div className="overflow-x-auto rounded-xl border border-[#e2e9f1] bg-white">
      <table className="data-table min-w-[520px]">
        <thead><tr><th>Rendimento mensal (Kz)</th><th>Taxa</th><th>Parcela a abater (Kz)</th></tr></thead>
        <tbody>
          {IRT_TABLE.map((step) => <tr key={step.label} className={step === bracket && valid ? 'bg-[#eef6ff] font-semibold' : ''}>
            <td>{step.label}</td><td>{Math.round(step.rate * 100)}%</td><td>{step.deduct.toLocaleString('pt-AO')}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
