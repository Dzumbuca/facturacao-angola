'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormActions, FormError } from '@/components/rh/form-kit';
import { RhModuleHero } from '@/components/rh/premium-kit';
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
      <RhModuleHero
        eyebrow="Organização"
        title="Departamentos"
        description="Estrutura hierárquica e responsáveis. Cria a cadeia antes de distribuir funções."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>}
        action={<button type="button" onClick={openCreate} className="min-h-12 rounded-[14px] bg-gradient-to-br from-[#021f87] via-[#0b2b6b] to-[#1b3a7a] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] transition hover:-translate-y-0.5">Novo departamento</button>}
      />

      {open && (
        <form onSubmit={submit} className="form-card-light rounded-xl border border-[#e6eaf0] p-4">
          <FormSection title={editing ? `Editar departamento (${editing.name})` : 'Novo departamento'}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="dept-name" className="app-label">Nome *</label><input id="dept-name" name="name" className="ds-input" required defaultValue={editing?.name ?? ''} /></div>
              <div><label htmlFor="dept-code" className="app-label">Código</label><input id="dept-code" name="code" className="ds-input" defaultValue={editing?.code ?? ''} /></div>
              <div><label htmlFor="dept-manager" className="app-label">Responsável</label><input id="dept-manager" name="managerName" className="ds-input" defaultValue={editing?.managerName ?? ''} /></div>
              <div><label htmlFor="dept-parent" className="app-label">Departamento pai</label><select id="dept-parent" name="parentId" className="ds-input" defaultValue={editing?.parentId ?? ''}><option value="">— (raiz)</option>{parentOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div className="sm:col-span-2"><label htmlFor="dept-desc" className="app-label">Descrição</label><input id="dept-desc" name="description" className="ds-input" defaultValue={editing?.description ?? ''} /></div>
            </div>
          </FormSection>
          <FormError>{error}</FormError>
          <div className="mt-3"><FormActions saving={saving} onCancel={() => { setOpen(false); setEditing(null); }} saveLabel={saving ? "A guardar…" : editing ? 'Guardar alterações' : 'Guardar'} /></div>
        </form>
      )}

      <div className="form-card-light overflow-x-auto rounded-xl border border-[#e6eaf0]">
        <table className="data-table min-w-[640px]">
          <thead><tr><th>Departamento</th><th>Código</th><th>Responsável</th><th>Funcionários</th><th>Cargos</th><th>Sub-departamentos</th><th>Acções</th></tr></thead>
          <tbody>
            {ordered.map(({ department, depth, cycle }) => (
              <tr key={department.id} className={cycle ? 'bg-[#fdf3f3]' : ''}>
                <td data-mobile-primary>
                  <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                    <span aria-hidden className="text-xs text-[#8a99ab]">{depth === 0 ? '■' : '└─'}</span>
                    <span className="font-semibold text-[var(--text)]">{department.name}</span>
                    <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--blue)]">{cycle ? 'ciclo' : depth === 0 ? 'raiz' : `N${depth}`}</span>
                  </div>
                </td>
                <td className="font-mono text-xs text-[var(--text-muted)]">{department.code || '—'}</td>
                <td>{department.managerName || '—'}</td>
                <td className="tabular-nums">{department._count.employees}</td>
                <td className="tabular-nums">{department._count.positions}</td>
                <td className="tabular-nums">{department._count.children}</td>
                <td data-mobile-actions><button type="button" onClick={() => openEdit(department)} className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue)]">Editar</button></td>
              </tr>
            ))}
            {departments.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-[#7094aa]">Ainda não há departamentos. Crie primeiro um pai e depois os filhos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
