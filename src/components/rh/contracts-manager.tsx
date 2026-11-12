'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormError } from '@/components/rh/form-kit';
type Contract = {
  id: string; type: string; status: string; startDate: string; endDate: string | null;
  salary: number; notes: string | null;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
};

const TYPE_LABEL: Record<string, string> = {
  INDEFINIDO: 'Tempo indeterminado', TERMO_CERTO: 'Termo certo', ESTAGIO: 'Estágio', PRESTACAO_SERVICOS: 'Prestação de serviços',
};
const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', ACTIVO: 'Activo', RENOVADO: 'Renovado', CESSAO: 'Cessão', EXPIRADO: 'Expirado',
};

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(value || 0);
}
function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString('pt-AO') : '—';
}

export function ContractsManager({ contracts, employees }: {
  contracts: Contract[];
  employees: { id: string; firstName: string; lastName: string; employeeNumber: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/rh/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: String(form.get('employeeId') ?? ''),
          type: String(form.get('type') ?? 'INDEFINIDO'),
          status: String(form.get('status') ?? 'RASCUNHO'),
          startDate: String(form.get('startDate') ?? ''),
          endDate: String(form.get('endDate') ?? '') || null,
          salary: String(form.get('salary') ?? ''),
          notes: String(form.get('notes') ?? ''),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">Vínculos</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Contratos</h1>
          <p className="mt-1 text-sm text-[#607286]">Contratos, renovações e datas de vencimento.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setOpen(true); }} disabled={employees.length === 0} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-50">Novo contrato</button>
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="ct-employee" className="app-label">Funcionário *</label><select id="ct-employee" name="employeeId" className="app-input" required><option value="">Selecionar</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeNumber})</option>)}</select></div>
            <div><label htmlFor="ct-type" className="app-label">Tipo *</label><select id="ct-type" name="type" className="app-input">{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label htmlFor="ct-status" className="app-label">Estado</label><select id="ct-status" name="status" className="app-input" defaultValue="RASCUNHO">{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label htmlFor="ct-start" className="app-label">Início *</label><input id="ct-start" name="startDate" type="date" className="app-input" required /></div>
            <div><label htmlFor="ct-end" className="app-label">Fim</label><input id="ct-end" name="endDate" type="date" className="app-input" /></div>
            <div><label htmlFor="ct-salary" className="app-label">Salário (Kz) *</label><input id="ct-salary" name="salary" type="number" min="0" step="0.01" className="app-input tabular-nums" required /></div>
            <div><label htmlFor="ct-notes" className="app-label">Notas</label><input id="ct-notes" name="notes" className="app-input" /></div>
          </div>
          <FormError>{error}</FormError>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-[#cdddeb] px-4 text-sm font-semibold text-[#52667a]">Cancelar</button>
            <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[760px]">
          <thead><tr><th>Funcionário</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Salário</th><th>Estado</th></tr></thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id}>
                <td data-mobile-primary>
                  <span className="block font-semibold text-[#1c2d3f]">{contract.employee.firstName} {contract.employee.lastName}</span>
                  <span className="block text-xs text-[#708195]">{contract.employee.employeeNumber}</span>
                </td>
                <td>{TYPE_LABEL[contract.type] ?? contract.type}</td>
                <td className="tabular-nums">{date(contract.startDate)}</td>
                <td className="tabular-nums">{date(contract.endDate)}</td>
                <td className="tabular-nums">{money(contract.salary)}</td>
                <td><span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#021f87]">{STATUS_LABEL[contract.status] ?? contract.status}</span></td>
              </tr>
            ))}
            {contracts.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há contratos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
