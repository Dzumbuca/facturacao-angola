'use client';

import { useState } from 'react';
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
const ACTIONS: { type: string; label: string; tone: string }[] = [
  { type: 'ENTRADA', label: 'Entrada', tone: 'bg-[#0f6b4f] hover:bg-[#0b5941]' },
  { type: 'SAIDA_ALMOCO', label: 'Saída almoço', tone: 'bg-[#8a5a00] hover:bg-[#714a00]' },
  { type: 'REGRESSO_ALMOCO', label: 'Regresso', tone: 'bg-[#021f87] hover:bg-[#061965]' },
  { type: 'SAIDA', label: 'Saída', tone: 'bg-[#7a2f2f] hover:bg-[#642626]' },
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
      <div>
        <p className="text-sm text-[var(--text-muted)]">Machine Point</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Assiduidade</h1>
        <Link href="/rh/ponto" className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--blue)]">Abrir quiosque →</Link>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Registo de ponto por PIN. Horários, turnos e QR chegam nas próximas fases.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-xs text-[var(--text-muted)]">Presentes hoje</p><p className="mt-1 text-xl font-bold tabular-nums"><CountUp value={present} durationMs={900} /></p></div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-xs text-[var(--text-muted)]">Marcações hoje</p><p className="mt-1 text-xl font-bold tabular-nums"><CountUp value={entries.length} durationMs={900} /></p></div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-xs text-[var(--text-muted)]">Funcionários com PIN</p><p className="mt-1 text-xl font-bold tabular-nums">{employees.filter((e) => e.hasPin).length}</p></div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-xs text-[var(--text-muted)]">Atrasados hoje</p><p className="mt-1 text-xl font-bold tabular-nums text-[#a83939]"><CountUp value={late} durationMs={900} /></p></div>
      </div>

      <section className="rounded-xl border border-[var(--line)] bg-white p-5">
        <h2 className="text-sm font-bold text-[var(--text)]">Registar marcação</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="att-employee" className="app-label">Funcionário</label>
            <select id="att-employee" className="app-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
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
            <input id="att-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={8} className="app-input tracking-[.3em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
          </div>
        </div>
        {selected && !selected.hasPin && <p className="mt-2 text-xs text-[#a83939]">Este funcionário ainda não tem PIN. Defina-o em Funcionários → Editar.</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTIONS.map((action) => (
            <button key={action.type} type="button" disabled={Boolean(savingType)} onClick={() => clock(action.type)} className={`min-h-12 rounded-lg px-3 text-sm font-semibold text-white transition disabled:opacity-50 ${action.tone}`}>
              {savingType === action.type ? 'A registar…' : action.label}
            </button>
          ))}
        </div>
        {message && <p role="status" className="mt-3 rounded-lg bg-[#eff9f4] px-3 py-2 text-sm font-medium text-[#267256]">{message}</p>}
        <FormError>{error}</FormError>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-white">
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
              {entries.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Ainda não há marcações hoje.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
