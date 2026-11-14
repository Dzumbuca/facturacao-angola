'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FormError } from '@/components/rh/form-kit';
import { CountUp } from '@/components/rh/count-up';
type Employee = { id: string; firstName: string; lastName: string; employeeNumber: string; hasPin: boolean };
type Entry = {
  id: string; type: string; source: string; occurredAt: string; lateMinutes: number; shiftName: string | null;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
};

const TYPE_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada', SAIDA_ALMOCO: 'Saída almoço', REGRESSO_ALMOCO: 'Regresso almoço', SAIDA: 'Saída',
};
const ACTIONS: { type: string; label: string; tone: string; icon: ReactNode }[] = [
  { type: 'ENTRADA', label: 'Entrada', tone: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M3 12h18"/><path d="M19 10l2 2-2 2"/><path d="M9 6l6 6-6 6"/></svg> },
  { type: 'SAIDA_ALMOCO', label: 'Saída almoço', tone: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/></svg> },
  { type: 'REGRESSO_ALMOCO', label: 'Regresso', tone: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg> },
  { type: 'SAIDA', label: 'Saída', tone: 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg> },
];

function time(value: string) {
  return new Date(value).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceManager({ entries, employees }: { entries: Entry[]; employees: Employee[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingType, setSavingType] = useState('');

  const selected = employees.find((employee) => employee.id === employeeId);
  const present = new Set(entries.filter((entry) => entry.type === 'ENTRADA').map((entry) => entry.employee.id)).size;
  const late = entries.filter((entry) => entry.type === 'ENTRADA' && entry.lateMinutes > 0).length;

  async function clock(type: string) {
    setError('');
    setMessage('');
    if (!employeeId) { setError('Seleciona o funcionário.'); return; }
    if (!pin) { setError('Introduz o PIN.'); return; }
    setSavingType(type);
    try {
      const response = await fetch('/api/rh/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, type, pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível registar.');
      setMessage(`${TYPE_LABEL[type]} registada às ${time(data.occurredAt)}.`);
      setPin('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingType('');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--text-muted)]">Machine Point</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Assiduidade</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Registo de ponto por PIN.</p>
        </div>
        <Link href="/rh/ponto" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#e1e8f0] bg-white px-4 text-sm font-medium text-[#1c2d3f] transition hover:border-[#021f87] hover:text-[#021f87]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Abrir quiosque</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M17 21v-2a4 4 0 0 0-4-4H7"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg></div><p className="mt-2 text-xs text-[var(--text-muted)]">Presentes hoje</p><p className="mt-1 text-xl font-bold tabular-nums"><CountUp value={present} durationMs={900} /></p></div>
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><p className="mt-2 text-xs text-[var(--text-muted)]">Marcações hoje</p><p className="mt-1 text-xl font-bold tabular-nums"><CountUp value={entries.length} durationMs={900} /></p></div>
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></div><p className="mt-2 text-xs text-[var(--text-muted)]">Funcionários com PIN</p><p className="mt-1 text-xl font-bold tabular-nums">{employees.filter((e) => e.hasPin).length}</p></div>
        <div className="form-card-light rounded-xl border border-[#e6eaf0] p-4"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${late > 0 ? 'bg-red-50 text-[#a83939]' : 'bg-slate-100 text-slate-600'}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p className="mt-2 text-xs text-[var(--text-muted)]">Atrasados hoje</p><p className={`mt-1 text-xl font-bold tabular-nums ${late > 0 ? 'text-[#a83939]' : 'text-[var(--text)]'}`}><CountUp value={late} durationMs={900} /></p></div>
      </div>

      <section className="form-card-light rounded-xl border border-[#e6eaf0] p-5">
        <h2 className="text-sm font-bold text-[var(--text)]">Registar marcação</h2>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-[#607286]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={14} height={14} aria-hidden="true"><path d="M12 3l2.2 6.2L20 12l-5.8 2.8L12 21l-2.2-6.2L4 12l5.8-2.8L12 3z"/></svg>Horários, turnos e QR Code disponíveis em breve neste módulo.</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="att-employee" className="app-label">Funcionário</label>
            <select id="att-employee" className="ds-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Selecionar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} ({employee.employeeNumber}){employee.hasPin ? '' : ' — sem PIN'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="att-pin" className="app-label">PIN</label>
            <input id="att-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} className="ds-input text-center text-2xl font-mono tracking-[.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
          </div>
        </div>
        {selected && !selected.hasPin && <p className="mt-2 text-xs text-[#a83939]">Este funcionário ainda não tem PIN. Defina-o em Funcionários → Editar.</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTIONS.map((action) => (
            <button key={action.type} type="button" disabled={Boolean(savingType)} onClick={() => clock(action.type)} aria-label={`Registar ${action.label}`} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-50 ${action.tone}`}>
              {savingType === action.type ? 'A registar…' : <>{action.icon}{action.label}</>}
            </button>
          ))}
        </div>
        {message && <p role="status" className="mt-3 rounded-lg bg-[#eff9f4] px-3 py-2 text-sm font-medium text-[#267256]">{message}</p>}
        <FormError>{error}</FormError>
      </section>

      <section className="form-card-light rounded-xl border border-[#e6eaf0]">
        <div className="border-b border-[#eef2f6] px-4 py-3"><h2 className="text-sm font-bold text-[var(--text)]">Marcações de hoje</h2></div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[560px]">
            <thead><tr><th>Hora</th><th>Funcionário</th><th>Marcação</th><th>Origem</th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td data-mobile-primary className="font-semibold tabular-nums">{time(entry.occurredAt)}</td>
                  <td>{entry.employee.firstName} {entry.employee.lastName} <span className="text-xs text-[var(--text-muted)]">{entry.employee.employeeNumber}</span>{entry.shiftName && <span className="ml-2 text-[11px] text-[#8a99ab]">{entry.shiftName}</span>}</td>
                  <td>{TYPE_LABEL[entry.type] ?? entry.type}{entry.lateMinutes > 0 && <span className="ml-2 rounded-full bg-[#fdf3f3] px-2 py-0.5 text-[10px] font-semibold text-[#a83939]">{entry.lateMinutes} min atraso</span>}</td>
                  <td><span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--blue)]">{entry.source}</span></td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={4}><div className="flex flex-col items-center justify-center py-10 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={28} height={28} aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><p className="mt-3 text-sm font-semibold text-[var(--text)]">Ainda não há marcações hoje.</p><p className="mt-1 text-xs text-[var(--text-muted)]">As marcações dos funcionários aparecerão aqui.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
