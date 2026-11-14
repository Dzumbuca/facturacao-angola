'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError, CurrencyInput, CalendarField } from '@/components/rh/form-kit';
import { SignedImage } from '@/components/rh/signed-image';
import { FormSplit, FormSidebar } from '@/components/rh/premium-kit';
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
      <section className="relative overflow-hidden rounded-2xl border border-[#0b2b6b] bg-gradient-to-br from-[#021f87] via-[#0b2b6b] to-[#1e3a8a] p-5 text-white shadow-[var(--shadow-cta)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 12h4M10 16h4"/></svg>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-200">Vínculos</p>
                <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white">Contratos</h1>
              </div>
            </div>
            <button type="button" onClick={() => { setError(''); setOpen(true); }} disabled={employees.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#021f87] shadow-sm transition hover:bg-[#eef2ff] disabled:opacity-50"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Novo contrato</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="text-2xl font-extrabold tabular-nums">{contracts.filter((c) => c.status === 'ACTIVO').length}</p><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-200">Activos</p></div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="text-2xl font-extrabold tabular-nums text-amber-300">{contracts.filter((c) => c.status === 'ACTIVO' && c.endDate && new Date(c.endDate).getTime() - Date.now() < 30 * 86_400_000).length}</p><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-200">A vencer</p></div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3"><p className="text-2xl font-extrabold tabular-nums">{contracts.length}</p><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-200">Total</p></div>
          </div>
          <p className="text-sm leading-relaxed text-blue-100">Contratos, renovações e datas de vencimento num só sítio.</p>
        </div>
      </section>

      {open && (
        <form onSubmit={submit} className="rounded-[18px] border border-[#e4e9f0] bg-white p-4 shadow-[var(--shadow-card)]">
          <FormSplit main={<>
          <FormSection title="Dados do contrato">
            <div className="sm:col-span-2">
              <FormField label="Funcionário" name="ct-employee" required>
                <select id="ct-employee" name="employeeId" className="ds-input" required value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                  <option value="">Selecionar</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeNumber})</option>)}
                </select>
              </FormField>
            </div>
            <div>
              <FormField label="Tipo" name="ct-type" required>
                <select id="ct-type" name="type" className="ds-input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </FormField>
            </div>
            <div>
              <FormField label="Estado" name="ct-status">
                <select id="ct-status" name="status" className="ds-input" defaultValue="RASCUNHO">{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
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
              <FormField label="Notas" name="ct-notes"><input id="ct-notes" name="notes" className="ds-input" /></FormField>
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

      {/* Mobile cards */}
      <ul className="grid grid-cols-1 gap-3 sm:hidden" aria-label="Contratos">
        {contracts.map((contract) => {
          const start = new Date(contract.startDate).getTime();
          const end = contract.endDate ? new Date(contract.endDate).getTime() : null;
          const tone = contract.status === 'ACTIVO' ? { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' } : contract.status === 'RENOVADO' ? { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' } : contract.status === 'CESSAO' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' } : contract.status === 'EXPIRADO' ? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' } : { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
          const totalMs = end ? Math.max(end - start, 1) : 0;
          const elapsedMs = end ? Math.max(0, Math.min(Date.now() - start, totalMs)) : 0;
          const pct = end ? Math.round((elapsedMs / totalMs) * 100) : 0;
          const remainingDays = end ? Math.ceil((end - Date.now()) / 86_400_000) : null;
          const barColor = remainingDays !== null ? (remainingDays < 30 ? 'bg-red-500' : remainingDays < 90 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200';
          return (
            <li key={contract.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start gap-3">
                <SignedImage path={null} alt={`${contract.employee.firstName} ${contract.employee.lastName}`} className="h-12 w-12 shrink-0 rounded-full border border-[var(--line)] object-cover" fallback={<div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#021f87] text-sm font-bold text-white">{contract.employee.firstName.charAt(0).toUpperCase()}{contract.employee.lastName.charAt(0).toUpperCase()}</div>} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--text)] break-words">{contract.employee.firstName} {contract.employee.lastName}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{contract.employee.employeeNumber}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.bg} ${tone.text}`}><span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{STATUS_LABEL[contract.status] ?? contract.status}</span>
                  </div>
                </div>
              </div>
              {remainingDays !== null && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] mb-1"><span className="text-[var(--text-muted)]">Duração do contrato</span><span className={`font-semibold ${remainingDays < 30 ? 'text-red-600' : 'text-[var(--text)]'}`}>{remainingDays} dias restantes</span></div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1 flex justify-between text-[9px] text-[var(--text-muted)]"><span>{date(contract.startDate)}</span><span>{date(contract.endDate)}</span></div>
                </div>
              )}
              <div className="mt-3 divide-y divide-[var(--line)] text-sm">
                <div className="flex items-center justify-between gap-4 py-2"><span className="text-xs font-medium text-[var(--text-muted)]">Tipo</span><span className="text-sm font-semibold text-[var(--text)]">{TYPE_LABEL[contract.type] ?? contract.type}</span></div>
                <div className="flex items-center justify-between gap-4 py-2"><span className="text-xs font-medium text-[var(--text-muted)]">Início</span><span className="text-sm font-semibold tabular-nums text-[var(--text)]">{date(contract.startDate)}</span></div>
                {contract.endDate && <div className="flex items-center justify-between gap-4 py-2"><span className="text-xs font-medium text-[var(--text-muted)]">Fim</span><span className={`text-sm font-semibold tabular-nums ${remainingDays !== null && remainingDays < 30 ? 'text-red-600' : 'text-[var(--text)]'}`}>{date(contract.endDate)}</span></div>}
              </div>
              <div className="mx-0 my-3 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Salário base</span><span className="text-base font-extrabold tabular-nums text-[#021f87]">{money(contract.salary)}</span></div>
            </li>
          );
        })}
        {contracts.length === 0 && <li className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-raised)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">Ainda não há contratos. Crie o primeiro.</li>}
      </ul>

      <div className="hidden sm:block form-card-light overflow-x-auto rounded-xl border border-[#e6eaf0]">
        <table className="data-table min-w-[760px]">
          <thead><tr><th>Funcionário</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Salário</th><th>Estado</th></tr></thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id}>
                <td data-mobile-primary>
                  <span className="block font-semibold text-[var(--text)]">{contract.employee.firstName} {contract.employee.lastName}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{contract.employee.employeeNumber}</span>
                </td>
                <td>{TYPE_LABEL[contract.type] ?? contract.type}</td>
                <td className="tabular-nums">{date(contract.startDate)}</td>
                <td className="tabular-nums">{date(contract.endDate)}</td>
                <td className="tabular-nums font-bold text-[var(--text)]">{money(contract.salary)}</td>
                <td>{(() => { const tone = contract.status === 'ACTIVO' ? { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' } : contract.status === 'RENOVADO' ? { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' } : contract.status === 'CESSAO' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' } : contract.status === 'EXPIRADO' ? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' } : { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' }; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone.bg} ${tone.text}`}><span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{STATUS_LABEL[contract.status] ?? contract.status}</span>; })()}</td>
              </tr>
            ))}
            {contracts.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-[#7094aa]">Ainda não há contratos. Crie o primeiro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
