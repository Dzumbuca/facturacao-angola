'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormActions, FormError } from '@/components/rh/form-kit';
type Shift = {
  id: string; name: string; startTime: string; endTime: string;
  toleranceMinutes: number; isActive: boolean; isNight: boolean; nightPremiumPercent: number;
  _count: { employees: number };
};

export function ShiftsManager({ shifts }: { shifts: Shift[] }) {
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
      const response = await fetch('/api/rh/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          startTime: String(form.get('startTime') ?? ''),
          endTime: String(form.get('endTime') ?? ''),
          toleranceMinutes: String(form.get('toleranceMinutes') ?? '0'),
          isNight: form.get('isNight') === 'on',
          nightPremiumPercent: Number(form.get('nightPremiumPercent') ?? '0'),
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
          <p className="text-sm text-[var(--text-muted)]">Machine Point</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Horários e turnos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Horas de entrada/saída e tolerância usadas no cálculo de atrasos.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Novo horário</button>
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-[var(--line)] bg-white p-4">
          <FormSection title="Horário / turno">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2"><label htmlFor="shift-name" className="app-label">Nome *</label><input id="shift-name" name="name" className="app-input" placeholder="Turno geral" required /></div>
              <div><label htmlFor="shift-start" className="app-label">Entrada *</label><input id="shift-start" name="startTime" type="time" className="app-input" required /></div>
              <div><label htmlFor="shift-end" className="app-label">Saída *</label><input id="shift-end" name="endTime" type="time" className="app-input" required /></div>
              <div><label htmlFor="shift-tol" className="app-label">Tolerância (min)</label><input id="shift-tol" name="toleranceMinutes" type="number" min="0" max="120" className="app-input" defaultValue="0" /></div>
              <div className="flex items-end gap-2"><label className="flex items-center gap-2 text-sm font-medium text-[#52667a]"><input id="shift-night" name="isNight" type="checkbox" /> Nocturno</label></div>
              <div><label htmlFor="shift-nightpct" className="app-label">Prémio nocturno (%)</label><input id="shift-nightpct" name="nightPremiumPercent" type="number" min="0" max="100" className="app-input" defaultValue="0" /></div>
            </div>
          </FormSection>
          <FormError>{error}</FormError>
          <div className="mt-3"><FormActions saving={saving} onCancel={() => setOpen(false)} saveLabel={saving ? "A guardar…" : "Guardar"} /></div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
        <table className="data-table min-w-[560px]">
          <thead><tr><th>Horário</th><th>Entrada</th><th>Saída</th><th>Tolerância</th><th>Funcionários</th><th>Estado</th></tr></thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td data-mobile-primary className="font-semibold text-[var(--text)]">{shift.name}</td>
                <td className="tabular-nums">{shift.startTime}</td>
                <td className="tabular-nums">{shift.endTime}</td>
                <td className="tabular-nums">{shift.toleranceMinutes} min</td>
                <td className="tabular-nums">{shift._count.employees}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${shift.isActive ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#f3f6fa] text-[var(--text-muted)]'}`}>{shift.isActive ? 'Activo' : 'Inactivo'}</span></td>
              </tr>
            ))}
            {shifts.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Ainda não há horários.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
