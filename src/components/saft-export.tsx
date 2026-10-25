'use client';

import { useState } from 'react';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function SaftExport() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return <div className="flex flex-wrap items-end gap-2">
    <div>
      <label htmlFor="saft-month" className="app-label">Mês</label>
      <select id="saft-month" className="app-input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
        {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="saft-year" className="app-label">Ano</label>
      <select id="saft-year" className="app-input" value={year} onChange={(event) => setYear(Number(event.target.value))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
    <a
      href={`/api/invoices/generate-saft?month=${month}&year=${year}`}
      className="inline-flex min-h-11 items-center rounded-xl bg-[#2878d0] px-5 text-sm font-semibold text-white transition hover:bg-[#216bbd]"
    >Descarregar SAFT-AO</a>
  </div>;
}
