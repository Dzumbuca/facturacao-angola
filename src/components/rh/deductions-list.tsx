'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Deduction = { id: string; description: string; type: string; amount: number; remainingInstallments: number | null; active: boolean; createdAt: string; employee: { id: string; firstName: string; lastName: string; employeeNumber: string } };

const TYPE_LABEL: Record<string, string> = { ADIANTAMENTO: 'Adiantamento', EMPRESTIMO: 'Empréstimo', OUTRO: 'Outro' };
const TYPE_TONE: Record<string, string> = { ADIANTAMENTO: 'bg-amber-50 text-amber-700 border-amber-200', EMPRESTIMO: 'bg-blue-50 text-blue-700 border-blue-200', OUTRO: 'bg-slate-100 text-slate-700 border-slate-200' };

function money(v: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', minimumFractionDigits: 2 }).format(v);
}

export function DeductionsList({ deductions }: { deductions: Deduction[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const visible = useMemo(() => deductions.filter((d) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || d.employee.firstName.toLowerCase().includes(q) || d.employee.lastName.toLowerCase().includes(q) || d.employee.employeeNumber.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
    const matchesStatus = status === 'all' || (status === 'active' && d.active) || (status === 'inactive' && !d.active);
    return matchesQuery && matchesStatus;
  }), [deductions, query, status]);
  const activeTotal = visible.filter((d) => d.active).reduce((sum, d) => sum + (d.remainingInstallments ?? 1) * d.amount, 0);
  const activeCount = visible.filter((d) => d.active).length;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#021f87]">Finanças</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1c2d3f]">Descontos</h1>
            <p className="mt-1 text-sm text-[#607286]">Adiantamentos, empréstimos e outros descontos de funcionários.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e1e8f0] bg-[#f5f8fc] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#708195]">Activos</p><p className="mt-1 tabular-nums text-2xl font-extrabold text-[#021f87]">{activeCount}</p></div>
            <div className="rounded-xl border border-[#e1e8f0] bg-[#f5f8fc] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#708195]">Por deduzir</p><p className="mt-1 tabular-nums text-base font-extrabold text-[#021f87]">{money(activeTotal)}</p></div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por funcionário, nº ou descrição"
          className="app-input flex-1"
          aria-label="Pesquisar descontos"
        />
        <div role="group" aria-label="Filtrar por estado" className="flex gap-2">
          {([['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Concluídos']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setStatus(value)} aria-pressed={status === value} className={`min-h-10 rounded-lg border px-4 text-xs font-semibold transition ${status === value ? 'border-[#021f87] bg-[#021f87] text-white' : 'border-[#cdd6e3] bg-white text-[#52667a] hover:bg-[#f4f6fb]'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e1e8f0] bg-[var(--surface-raised)] px-6 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef2f6]"><svg viewBox="0 0 24 24" fill="none" stroke="#8ca0b5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={28} height={28} aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg></div>
          <p className="mt-3 text-sm font-semibold text-[var(--text)]">Nenhum desconto encontrado.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Crie o primeiro desconto a partir do detalhe do funcionário.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {visible.map((deduction) => (
            <li key={deduction.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#021f87] text-sm font-bold text-white">{deduction.employee.firstName.charAt(0).toUpperCase()}{deduction.employee.lastName.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <Link href={`/rh/funcionarios/${deduction.employee.id}`} className="block truncate font-semibold text-[var(--text)] hover:text-[var(--blue)] hover:underline">{deduction.employee.firstName} {deduction.employee.lastName}</Link>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Nº {deduction.employee.employeeNumber}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${TYPE_TONE[deduction.type] ?? TYPE_TONE.OUTRO}`}>{TYPE_LABEL[deduction.type] ?? deduction.type}</span>
              </div>
              <div className="mt-3 divide-y divide-[var(--line)] text-sm">
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Descrição</span>
                  <span className="break-words text-right font-semibold text-[var(--text)]">{deduction.description}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Valor</span>
                  <span className="tabular-nums font-extrabold text-[var(--text)]">{money(deduction.amount)}{deduction.remainingInstallments ? ` × ${deduction.remainingInstallments}` : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Estado</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${deduction.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${deduction.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{deduction.active ? 'Activo' : 'Concluído'}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
