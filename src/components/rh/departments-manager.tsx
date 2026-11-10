'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Department = {
  id: string; name: string; code: string | null; managerName: string | null;
  parentId: string | null;
  _count: { employees: number; positions: number; children: number };
};

export function DepartmentsManager({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/rh/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          code: String(form.get('code') ?? ''),
          managerName: String(form.get('managerName') ?? ''),
          parentId: String(form.get('parentId') ?? '') || null,
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
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Departamentos</h1>
          <p className="mt-1 text-sm text-[#607286]">Estrutura hierárquica e responsáveis.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Novo departamento</button>
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="dept-name" className="app-label">Nome *</label><input id="dept-name" name="name" className="app-input" required /></div>
            <div><label htmlFor="dept-code" className="app-label">Código</label><input id="dept-code" name="code" className="app-input" /></div>
            <div><label htmlFor="dept-manager" className="app-label">Responsável</label><input id="dept-manager" name="managerName" className="app-input" /></div>
            <div><label htmlFor="dept-parent" className="app-label">Departamento pai</label><select id="dept-parent" name="parentId" className="app-input"><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="sm:col-span-2"><label htmlFor="dept-desc" className="app-label">Descrição</label><input id="dept-desc" name="description" className="app-input" /></div>
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#a83939]">{error}</p>}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-[#cdddeb] px-4 text-sm font-semibold text-[#52667a]">Cancelar</button>
            <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[640px]">
          <thead><tr><th>Departamento</th><th>Código</th><th>Responsável</th><th>Funcionários</th><th>Cargos</th><th>Sub-departamentos</th></tr></thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{department.name}</td>
                <td className="font-mono text-xs text-[#607286]">{department.code || '—'}</td>
                <td>{department.managerName || '—'}</td>
                <td className="tabular-nums">{department._count.employees}</td>
                <td className="tabular-nums">{department._count.positions}</td>
                <td className="tabular-nums">{department._count.children}</td>
              </tr>
            ))}
            {departments.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há departamentos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
