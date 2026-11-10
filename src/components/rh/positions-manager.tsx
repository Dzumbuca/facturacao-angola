'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Position = {
  id: string; title: string; code: string | null; level: number | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  _count: { employees: number };
};

export function PositionsManager({ positions, departments }: {
  positions: Position[];
  departments: { id: string; name: string }[];
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
      const response = await fetch('/api/rh/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(form.get('title') ?? ''),
          code: String(form.get('code') ?? ''),
          departmentId: String(form.get('departmentId') ?? '') || null,
          level: String(form.get('level') ?? '') || null,
          description: String(form.get('description') ?? ''),
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
          <p className="text-sm text-[#708195]">Organização</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Cargos</h1>
          <p className="mt-1 text-sm text-[#607286]">Funções por departamento e nível hierárquico.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Novo cargo</button>
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="pos-title" className="app-label">Título *</label><input id="pos-title" name="title" className="app-input" required /></div>
            <div><label htmlFor="pos-code" className="app-label">Código</label><input id="pos-code" name="code" className="app-input" /></div>
            <div><label htmlFor="pos-dept" className="app-label">Departamento</label><select id="pos-dept" name="departmentId" className="app-input"><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label htmlFor="pos-level" className="app-label">Nível</label><input id="pos-level" name="level" type="number" min="1" className="app-input" /></div>
            <div className="sm:col-span-2"><label htmlFor="pos-desc" className="app-label">Descrição</label><input id="pos-desc" name="description" className="app-input" /></div>
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
          <thead><tr><th>Cargo</th><th>Código</th><th>Departamento</th><th>Nível</th><th>Funcionários</th></tr></thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{position.title}</td>
                <td className="font-mono text-xs text-[#607286]">{position.code || '—'}</td>
                <td>{position.department?.name ?? '—'}</td>
                <td className="tabular-nums">{position.level ?? '—'}</td>
                <td className="tabular-nums">{position._count.employees}</td>
              </tr>
            ))}
            {positions.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há cargos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
