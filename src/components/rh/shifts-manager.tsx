'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Shift = {
  id: string; name: string; startTime: string; endTime: string;
  toleranceMinutes: number; isActive: boolean;
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
          <p className="text-sm text-[#708195]">Machine Point</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Horários e turnos</h1>
          <p className="mt-1 text-sm text-[#607286]">Horas de entrada/saída e tolerância usadas no cálculo de atrasos.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Novo horário</button>
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><label htmlFor="shift-name" className="app-label">Nome *</label><input id="shift-name" name="name" className="app-input" placeholder="Turno geral" required /></div>
            <div><label htmlFor="shift-start" className="app-label">Entrada *</label><input id="shift-start" name="startTime" type="time" className="app-input" required /></div>
            <div><label htmlFor="shift-end" className="app-label">Saída *</label><input id="shift-end" name="endTime" type="time" className="app-input" required /></div>
            <div><label htmlFor="shift-tol" className="app-label">Tolerância (min)</label><input id="shift-tol" name="toleranceMinutes" type="number" min="0" max="120" className="app-input" defaultValue="0" /></div>
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#a83939]">{error}</p>}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-[#cdddeb] px-4 text-sm font-semibold text-[#52667a]">Cancelar</button>
            <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[560px]">
          <thead><tr><th>Horário</th><th>Entrada</th><th>Saída</th><th>Tolerância</th><th>Funcionários</th><th>Estado</th></tr></thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{shift.name}</td>
                <td className="tabular-nums">{shift.startTime}</td>
                <td className="tabular-nums">{shift.endTime}</td>
                <td className="tabular-nums">{shift.toleranceMinutes} min</td>
                <td className="tabular-nums">{shift._count.employees}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${shift.isActive ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#f3f6fa] text-[#607286]'}`}>{shift.isActive ? 'Activo' : 'Inactivo'}</span></td>
              </tr>
            ))}
            {shifts.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há horários.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
