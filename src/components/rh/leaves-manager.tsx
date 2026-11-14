'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { RhModuleHero, FormSplit, FormSidebar } from '@/components/rh/premium-kit';
import { FormSection, FormField, FormActions, FormError, CalendarField } from '@/components/rh/form-kit';
type Employee = { id: string; firstName: string; lastName: string; employeeNumber: string };
type Leave = {
  id: string; type: string; status: string; startDate: string; endDate: string; days: number;
  reason: string | null; decisionNote: string | null;
  employee: Employee;
};

const TYPE_LABEL: Record<string, string> = {
  FERIAS: 'Férias', LICENCA: 'Licença', DISPENSA: 'Dispensa', DOENCA: 'Doença', OUTRA: 'Outra',
};
const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado', CANCELADO: 'Cancelado',
};
const STATUS_TONE: Record<string, string> = {
  PENDENTE: 'bg-[#fff7e6] text-[#8a5a00]',
  APROVADO: 'bg-[#eff9f4] text-[#267256]',
  REJEITADO: 'bg-[#fdf3f3] text-[#a83939]',
  CANCELADO: 'bg-[#f3f6fa] text-[var(--text-muted)]',
};

function date(value: string) {
  return new Date(value).toLocaleDateString('pt-AO');
}

export function LeavesManager({ leaves, employees, vacationDaysPerYear }: {
  leaves: Leave[];
  employees: Employee[];
  vacationDaysPerYear: number | null;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState('FERIAS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const year = new Date().getFullYear();
  const approved = useMemo(() => leaves.filter((leave) => leave.type === 'FERIAS' && leave.status === 'APROVADO').reduce((sum, leave) => sum + leave.days, 0), [leaves]);
  const pending = useMemo(() => leaves.filter((leave) => leave.type === 'FERIAS' && leave.status === 'PENDENTE').reduce((sum, leave) => sum + leave.days, 0), [leaves]);
  const balance = vacationDaysPerYear === null ? null : vacationDaysPerYear - approved - pending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/rh/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, type, startDate, endDate, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível registar.');
      setMessage('Pedido registado como pendente.');
      setEmployeeId(''); setStartDate(''); setEndDate(''); setReason('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, status: 'APROVADO' | 'REJEITADO') {
    setError(''); setMessage('');
    try {
      const response = await fetch(`/api/rh/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível decidir.');
      setMessage(status === 'APROVADO' ? 'Pedido aprovado.' : 'Pedido rejeitado.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <RhModuleHero
        eyebrow="Pessoas"
        title="Férias e licenças"
        description={`Pedidos, aprovação, saldo e mapa do ano ${year}. Saldo e histórico ficam no mesmo sítio, sem surpresas no fim do mês.`}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/><path d="M9 14l2 2 4-4"/></svg>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><p className="text-xs text-[var(--text-muted)]">Aprovadas</p><p className="mt-1 text-xl font-bold tabular-nums">{approved} d</p></div>
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><p className="text-xs text-[var(--text-muted)]">Pendentes</p><p className="mt-1 text-xl font-bold tabular-nums">{pending} d</p></div>
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><p className="text-xs text-[var(--text-muted)]">Direito anual</p><p className="mt-1 text-xl font-bold tabular-nums">{vacationDaysPerYear === null ? '—' : `${vacationDaysPerYear} d`}</p></div>
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><p className="text-xs text-[var(--text-muted)]">Saldo</p><p className={`mt-1 text-xl font-bold tabular-nums ${balance !== null && balance < 0 ? 'text-[#a83939]' : ''}`}>{balance === null ? '—' : `${balance} d`}</p></div>
      </div>

      <form onSubmit={submit} className="form-card-light rounded-[18px] border border-[#e4e9f0] p-4 shadow-[var(--shadow-card)]">
        <FormSplit main={<>
        <h2 className="text-sm font-bold text-[var(--text)]">Novo pedido</h2>
        <FormSection title="Dados do pedido">
          <div className="sm:col-span-2">
            <FormField label="Funcionário" name="leave-employee" required>
              <select id="leave-employee" className="ds-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                <option value="">Selecionar</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeNumber})</option>)}
              </select>
            </FormField>
          </div>
          <div>
            <FormField label="Tipo" name="leave-type">
              <select id="leave-type" className="ds-input" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </FormField>
          </div>
          <div>
            <FormField label="Início" name="leave-start" required><CalendarField id="leave-start" name="leave-start" value={startDate} onChange={setStartDate} required /></FormField>
          </div>
          <div>
            <FormField label="Fim" name="leave-end" required><CalendarField id="leave-end" name="leave-end" value={endDate} onChange={setEndDate} required /></FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Motivo" name="leave-reason"><input id="leave-reason" className="ds-input" value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
          </div>
        </FormSection>
        {message && <p role="status" className="mt-3 rounded-lg bg-[#eff9f4] px-3 py-2 text-sm text-[#267256]">{message}</p>}
        <FormError>{error}</FormError>
        <div className="mt-3 flex justify-end">
          <FormActions saving={saving} onCancel={() => {}} saveLabel={saving ? 'A registar…' : 'Registar pedido'} />
        </div>
        </>}
        sidebar={<FormSidebar title="Resumo do pedido" progress={(type ? 20 : 0) + (startDate ? 25 : 0) + (endDate ? 25 : 0) + (employeeId ? 30 : 0)} lines={[
          { label: 'Tipo', value: (TYPE_LABEL as any)[type] ?? type },
          { label: 'Funcionário', value: employees.find((e) => e.id === employeeId) ? `${employees.find((e) => e.id === employeeId)!.firstName} ${employees.find((e) => e.id === employeeId)!.lastName}` : undefined },
          { label: 'Dias', value: startDate && endDate ? String(Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1) : undefined },
          { label: 'Início', value: startDate || undefined },
          { label: 'Fim', value: endDate || undefined },
          { label: 'Saldo', value: balance === null ? '—' : `${balance} d` },
        ]} footer={<p className="text-[11px] leading-5 text-[#8094a9]">A percentagem reflecte campos preenchidos. O saldo só é aplicado quando o pedido for aprovado.</p>} />} />
      </form>

      <div className="form-card-light overflow-x-auto rounded-xl border border-[#e6eaf0]">
        <table className="data-table min-w-[760px]">
          <thead><tr><th>Funcionário</th><th>Tipo</th><th>Período</th><th>Dias</th><th>Estado</th><th>Acções</th></tr></thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id}>
                <td data-mobile-primary><span className="block font-semibold text-[var(--text)]">{leave.employee.firstName} {leave.employee.lastName}</span><span className="block text-xs text-[var(--text-muted)]">{leave.employee.employeeNumber}</span></td>
                <td>{TYPE_LABEL[leave.type] ?? leave.type}</td>
                <td className="tabular-nums">{date(leave.startDate)} → {date(leave.endDate)}</td>
                <td className="tabular-nums">{leave.days}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[leave.status] ?? ''}`}>{STATUS_LABEL[leave.status] ?? leave.status}</span></td>
                <td data-mobile-actions>
                  {leave.status === 'PENDENTE' ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => decide(leave.id, 'APROVADO')} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256]">Aprovar</button>
                      <button type="button" onClick={() => decide(leave.id, 'REJEITADO')} className="min-h-9 rounded-lg border border-[#f0d3d3] px-3 text-xs font-semibold text-[#a83939]">Rejeitar</button>
                    </div>
                  ) : <span className="text-xs text-[#8a99ab]">—</span>}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Ainda não há pedidos este ano.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
