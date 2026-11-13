'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormActions, FormError } from '@/components/rh/form-kit';
import { RhModuleHero } from '@/components/rh/premium-kit';
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
      <RhModuleHero
        eyebrow="Organização"
        title="Cargos"
        description="Funções por departamento e nível hierárquico. Estrutura a empresa antes de contratar."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8 4.03-8 9-8 9 3.582 9 8z"/></svg>}
        action={<button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-12 rounded-[14px] bg-gradient-to-br from-[#021f87] via-[#0b2b6b] to-[#1b3a7a] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] transition hover:-translate-y-0.5">Novo cargo</button>}
      />

      {open && (
        <form onSubmit={submit} className="rounded-xl border border-[var(--line)] bg-white p-4">
          <FormSection title="Dados do cargo">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="pos-title" className="app-label">Título *</label><input id="pos-title" name="title" className="app-input" required /></div>
              <div><label htmlFor="pos-code" className="app-label">Código</label><input id="pos-code" name="code" className="app-input" /></div>
              <div><label htmlFor="pos-dept" className="app-label">Departamento</label><select id="pos-dept" name="departmentId" className="app-input"><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label htmlFor="pos-level" className="app-label">Nível</label><input id="pos-level" name="level" type="number" min="1" className="app-input" /></div>
              <div className="sm:col-span-2"><label htmlFor="pos-desc" className="app-label">Descrição</label><input id="pos-desc" name="description" className="app-input" /></div>
            </div>
          </FormSection>
          <FormError>{error}</FormError>
          <div className="mt-3"><FormActions saving={saving} onCancel={() => setOpen(false)} saveLabel={saving ? "A guardar…" : "Guardar"} /></div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
        <table className="data-table min-w-[560px]">
          <thead><tr><th>Cargo</th><th>Código</th><th>Departamento</th><th>Nível</th><th>Funcionários</th></tr></thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.id}>
                <td data-mobile-primary className="font-semibold text-[var(--text)]">{position.title}</td>
                <td className="font-mono text-xs text-[var(--text-muted)]">{position.code || '—'}</td>
                <td>{position.department?.name ?? '—'}</td>
                <td className="tabular-nums">{position.level ?? '—'}</td>
                <td className="tabular-nums">{position._count.employees}</td>
              </tr>
            ))}
            {positions.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Ainda não há cargos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
