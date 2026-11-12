'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormActions, FormError } from '@/components/rh/form-kit';
type Department = {
  id: string; name: string; code: string | null; managerName: string | null;
  parentId: string | null; description: string | null;
  _count: { employees: number; positions: number; children: number };
};

type OrderedDepartment = { department: Department; depth: number; cycle: boolean };

/** Constrói árvore recursiva e devolve lista em ordem visual (raiz → filhos), detectando ciclos. */
function buildOrdered(departments: Department[]): OrderedDepartment[] {
  const byParent = new Map<string | null, Department[]>();
  for (const department of departments) {
    const key = department.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(department);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'pt-AO'));

  const ordered: OrderedDepartment[] = [];
  const walk = (parentId: string | null, depth: number, ancestors: Set<string>) => {
    const children = byParent.get(parentId) ?? [];
    for (const department of children) {
      if (ancestors.has(department.id)) {
        ordered.push({ department, depth, cycle: true });
        continue;
      }
      const nextAncestors = new Set(ancestors); nextAncestors.add(department.id);
      ordered.push({ department, depth, cycle: false });
      walk(department.id, depth + 1, nextAncestors);
    }
  };
  walk(null, 0, new Set());
  for (const department of departments) {
    if (!ordered.some((item) => item.department.id === department.id)) {
      ordered.push({ department, depth: 0, cycle: true });
    }
  }
  return ordered;
}

export function DepartmentsManager({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const ordered = buildOrdered(departments);

  function openCreate() { setError(''); setEditing(null); setOpen(true); }
  function openEdit(department: Department) { setError(''); setEditing(department); setOpen(true); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const response = await fetch(editing ? `/api/rh/departments/${editing.id}` : '/api/rh/departments', {
        method: editing ? 'PATCH' : 'POST',
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
      setEditing(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const parentOptions = departments.filter((d) => d.id !== editing?.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">Organização</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Departamentos</h1>
          <p className="mt-1 text-sm text-[#607286]">Estrutura hierárquica e responsáveis.</p>
        </div>
        <button type="button" onClick={openCreate} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Novo departamento</button>
      </div>

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <FormSection title={editing ? `Editar departamento (${editing.name})` : 'Novo departamento'}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="dept-name" className="app-label">Nome *</label><input id="dept-name" name="name" className="app-input" required defaultValue={editing?.name ?? ''} /></div>
              <div><label htmlFor="dept-code" className="app-label">Código</label><input id="dept-code" name="code" className="app-input" defaultValue={editing?.code ?? ''} /></div>
              <div><label htmlFor="dept-manager" className="app-label">Responsável</label><input id="dept-manager" name="managerName" className="app-input" defaultValue={editing?.managerName ?? ''} /></div>
              <div><label htmlFor="dept-parent" className="app-label">Departamento pai</label><select id="dept-parent" name="parentId" className="app-input" defaultValue={editing?.parentId ?? ''}><option value="">— (raiz)</option>{parentOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div className="sm:col-span-2"><label htmlFor="dept-desc" className="app-label">Descrição</label><input id="dept-desc" name="description" className="app-input" defaultValue={editing?.description ?? ''} /></div>
            </div>
          </FormSection>
          <FormError>{error}</FormError>
          <div className="mt-3"><FormActions saving={saving} onCancel={() => { setOpen(false); setEditing(null); }} saveLabel={saving ? "A guardar…" : editing ? 'Guardar alterações' : 'Guardar'} /></div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[640px]">
          <thead><tr><th>Departamento</th><th>Código</th><th>Responsável</th><th>Funcionários</th><th>Cargos</th><th>Sub-departamentos</th><th>Acções</th></tr></thead>
          <tbody>
            {ordered.map(({ department, depth, cycle }) => (
              <tr key={department.id} className={cycle ? 'bg-[#fdf3f3]' : ''}>
                <td data-mobile-primary>
                  <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                    <span aria-hidden className="text-xs text-[#8a99ab]">{depth === 0 ? '■' : '└─'}</span>
                    <span className="font-semibold text-[#1c2d3f]">{department.name}</span>
                    <span className="rounded bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#021f87]">{cycle ? 'ciclo' : depth === 0 ? 'raiz' : `N${depth}`}</span>
                  </div>
                </td>
                <td className="font-mono text-xs text-[#607286]">{department.code || '—'}</td>
                <td>{department.managerName || '—'}</td>
                <td className="tabular-nums">{department._count.employees}</td>
                <td className="tabular-nums">{department._count.positions}</td>
                <td className="tabular-nums">{department._count.children}</td>
                <td data-mobile-actions><button type="button" onClick={() => openEdit(department)} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">Editar</button></td>
              </tr>
            ))}
            {departments.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há departamentos. Cria primeiro um pai (ex.: «Angola») e depois os filhos (ex.: «Administração»).</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
