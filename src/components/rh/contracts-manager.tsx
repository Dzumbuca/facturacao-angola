'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError, CurrencyInput, CalendarField } from '@/components/rh/form-kit';
import { RhModuleHero, FormSplit, FormSidebar } from '@/components/rh/premium-kit';
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
  const [startIso, setStartIso] = useState('');
  const [endIso, setEndIso] = useState('');
  const [salaryValue, setSalaryValue] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedType, setSelectedType] = useState('INDEFINIDO');

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
      <RhModuleHero
        eyebrow="Vínculos"
        title="Contratos"
        description="Contratos, renovações e datas de vencimento. Cria rascunhos e mantém o controlo de datas num só sítio."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>}
        action={<button type="button" onClick={() => { setError(''); setOpen(true); }} disabled={employees.length === 0} className="min-h-12 rounded-[14px] bg-gradient-to-br from-[#021f87] via-[#0b2b6b] to-[#1b3a7a] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] transition hover:-translate-y-0.5 disabled:opacity-50">Novo contrato</button>}
      />

      {open && (
        <form onSubmit={submit} className="rounded-[18px] border border-[#e4e9f0] bg-white p-4 shadow-[var(--shadow-card)]">
          <FormSplit main={<>
          <FormSection title="Dados do contrato">
            <div className="sm:col-span-2">
              <FormField label="Funcionário" name="ct-employee" required>
                <select id="ct-employee" name="employeeId" className="app-input" required value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                  <option value="">Selecionar</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeNumber})</option>)}
                </select>
              </FormField>
            </div>
            <div>
              <FormField label="Tipo" name="ct-type" required>
                <select id="ct-type" name="type" className="app-input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </FormField>
            </div>
            <div>
              <FormField label="Estado" name="ct-status">
                <select id="ct-status" name="status" className="app-input" defaultValue="RASCUNHO">{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </FormField>
            </div>
            <div>
              <FormField label="Início" name="ct-start" required><CalendarField id="ct-start" name="startDate" value={startIso} onChange={setStartIso} required /></FormField>
            </div>
            <div>
              <FormField label="Fim" name="ct-end"><CalendarField id="ct-end" name="endDate" value={endIso} onChange={setEndIso} /></FormField>
            </div>
            <div>
              <FormField label="Salário (Kz)" name="ct-salary" required><CurrencyInput id="ct-salary" name="salary" value={salaryValue} onChange={setSalaryValue} required /></FormField>
            </div>
            <div>
              <FormField label="Notas" name="ct-notes"><input id="ct-notes" name="notes" className="app-input" /></FormField>
            </div>
          </FormSection>
          <FormError>{error}</FormError>
          </>}
          sidebar={<FormSidebar title="Resumo do contrato" progress={(selectedEmployeeId ? 20 : 0) + (selectedType ? 15 : 0) + (startIso ? 25 : 0) + (endIso ? 20 : 0) + (salaryValue != null ? 20 : 0)} lines={[
            { label: 'Funcionário', value: employees.find((e) => e.id === selectedEmployeeId) ? `${employees.find((e) => e.id === selectedEmployeeId)!.firstName} ${employees.find((e) => e.id === selectedEmployeeId)!.lastName}` : undefined },
            { label: 'Tipo', value: TYPE_LABEL[selectedType] },
            { label: 'Início', value: startIso || undefined },
            { label: 'Fim', value: endIso || undefined },
            { label: 'Salário', value: salaryValue != null ? new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(salaryValue) : undefined },
          ]} footer={<p className="text-[11px] leading-5 text-[#8094a9]">A percentagem reflecte campos-chave preenchidos. O contrato só é válido com Funcionário, Início e Salário.</p>} />} />
          <div className="mt-3"><FormActions saving={saving} onCancel={() => setOpen(false)} saveLabel={saving ? 'A guardar…' : 'Guardar'} /></div>
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
            {contracts.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-[#7094aa]">Ainda não há contratos. Crie o primeiro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
