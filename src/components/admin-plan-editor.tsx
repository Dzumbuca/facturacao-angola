'use client';

import { useState } from 'react';
import { upsertCommercialPlan, togglePlanModule, setPlanLimit, setPlanCapability, setPlanActive } from '@/lib/admin-planos';

type AdminPlan = {
  id: string; slug: string; name: string; description: string | null;
  priceKz: number; priceYearly: number | null; isBundle: boolean; isActive: boolean;
  applications: { slug: string; name: string; isCore: boolean }[];
  limits: { metric: string; value: number | null }[];
  capabilities: { capability: string; enabled: boolean }[];
};

const METRICS = [
  ['max_warehouses', 'Máx. armazéns activos'],
  ['max_products', 'Máx. produtos'],
  ['max_clients', 'Máx. clientes'],
  ['max_invoices_per_month', 'Máx. facturas/mês'],
] as const;

const REASON_PLACEHOLDER = 'Motivo (obrigatório)';

export function AdminPlanEditor({ plans, applications }: { plans: AdminPlan[]; applications: { slug: string; name: string }[] }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('2500');
  const [newBundle, setNewBundle] = useState(false);
  const [reason, setReason] = useState('');

  function priceText(p: AdminPlan) {
    return p.priceKz === 0 ? 'Gratuito' : `${new Intl.NumberFormat('pt-AO').format(p.priceKz)} Kz/mês`;
  }

  async function run(key: string, fn: () => Promise<{ ok: boolean; message: string }>) {
    if (!reason.trim()) { setError('Motivo é obrigatório.'); return; }
    setBusy(key); setError('');
    const r = await fn();
    if (!r.ok) setError(r.message);
    setBusy('');
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) return setError('Motivo é obrigatório.');
    const priceKz = Number(newPrice.replace(',', '.'));
    if (!Number.isFinite(priceKz) || priceKz < 0) return setError('Preço inválido.');
    setBusy('create'); setError('');
    const r = await upsertCommercialPlan({ name: newName, slug: newSlug || undefined, description: newDesc, priceKz, isBundle: newBundle });
    if (!r.ok) setError(r.message);
    else { setNewName(''); setNewSlug(''); setNewDesc(''); setNewPrice('2500'); }
    setBusy('');
  }

  async function savePlan(id: string, data: FormData) {
    const priceKz = Number(String(data.get('priceKz') ?? '').replace(',', '.'));
    if (!Number.isFinite(priceKz) || priceKz < 0) return setError('Preço inválido.');
    await run('save-' + id, () => upsertCommercialPlan({ id, name: String(data.get('name') ?? ''), description: String(data.get('description') ?? ''), priceKz, isBundle: data.get('isBundle') === 'on' }));
  }

  async function toggleApp(id: string, slug: string, enabled: boolean) {
    await run(`module-${id}-${slug}`, () => togglePlanModule(id, slug, enabled));
  }

  async function saveLimit(id: string, metric: string, value: number | null) {
    await run(`limit-${id}-${metric}`, () => setPlanLimit(id, metric, value));
  }

  return (
    <div className="mt-5 space-y-5">
      <label className="block"><span className="app-label">Motivo (obrigatório para todas as alterações)</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={REASON_PLACEHOLDER} minLength={5} className="app-input" /></label>
      {error && <p role="alert" className="rounded-lg bg-[#fdf3f3] px-3 py-2 text-sm text-[#a83939]">{error}</p>}

      <form onSubmit={createPlan} className="grid gap-3 rounded-xl border border-[#dfe7f0] bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do pacote" className="app-input" required />
        <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="slug (ex.: premium)" className="app-input" />
        <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Preço (ex.: 2500)" className="app-input" inputMode="decimal" required />
        <button type="submit" disabled={busy === 'create'} className="rounded-lg bg-[#021f87] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy === 'create' ? 'A criar…' : 'Criar pacote'}</button>
        <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descrição" className="app-input sm:col-span-4" />
        <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" checked={newBundle} onChange={(e) => setNewBundle(e.target.checked)} /> Bundle (preço inferior à soma dos módulos)</label>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <section key={plan.id} className="rounded-xl border border-[#e1e8f0] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-bold text-[#1c2d3f]">{plan.name}</h2><p className="text-sm text-[#607286]">{plan.slug} · {priceText(plan)} · {plan.isBundle ? 'Bundle' : 'Avulso'} · {plan.isActive ? 'Activo' : 'Desactivado'}</p></div>
              <button type="button" onClick={() => run('toggle-' + plan.id, () => setPlanActive(plan.id, !plan.isActive))} disabled={busy === 'toggle-' + plan.id} className="rounded-lg border border-[#cdddeb] px-3 py-2 text-xs font-semibold text-[#021f87] disabled:opacity-60">{plan.isActive ? 'Desactivar' : 'Activar'}</button>
            </div>
            <p className="mt-1 text-xs text-[#708195]">{plan.description}</p>

            <form action={(d) => savePlan(plan.id, d)} className="mt-3 grid gap-2 rounded-xl border border-[#eef2f6] p-3">
              <label><span className="app-label">Nome</span><input name="name" defaultValue={plan.name} className="app-input" required /></label>
              <label><span className="app-label">Descrição</span><input name="description" defaultValue={plan.description ?? ''} className="app-input" /></label>
              <label><span className="app-label">Preço Kz/mês</span><input name="priceKz" inputMode="decimal" defaultValue={String(plan.priceKz).replace('.', ',')} className="app-input" required /></label>
              <label className="flex items-center gap-2 text-xs text-[#52667a]">Bundle<input name="isBundle" type="checkbox" defaultChecked={plan.isBundle} /></label>
              <button type="submit" disabled={busy === 'save-' + plan.id} className="self-end rounded-lg bg-[#021f87] px-3 py-2 text-xs font-semibold text-white">{busy === 'save-' + plan.id ? 'A guardar…' : 'Guardar alterações'}</button>
            </form>

            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#8a99ab]">Módulos incluídos</p>
              <div className="mt-1 grid gap-1">{applications.map((app) => {
                const selected = plan.applications.some((a) => a.slug === app.slug);
                return <button key={app.slug} type="button" onClick={() => toggleApp(plan.id, app.slug, !selected)} disabled={busy === `module-${plan.id}-${app.slug}`} className={`flex min-h-9 items-center justify-between rounded-lg border px-2 text-xs ${selected ? 'border-[#021f87]/30 bg-[#eef4ff] text-[#021f87]' : 'border-[#e6e5e2] text-[#708195]'}`}><span>{app.name}</span><span className="font-semibold">{selected ? '✓' : '+'}</span></button>;
              })}</div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#8a99ab]">Limites</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">{METRICS.map(([metric, label]) => {
                const value = plan.limits.find((l) => l.metric === metric)?.value ?? null;
                return <label key={metric} className="flex items-center gap-2 text-xs"><span className="w-36 text-[#52667a]">{label}</span><input inputMode="numeric" defaultValue={value === null ? '' : String(value)} placeholder="Sem limite" className="app-input w-24" onBlur={(e) => { const raw = e.target.value.trim(); const parsed = raw === '' ? null : Number(raw.replace(',', '.')); if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return; saveLimit(plan.id, metric, parsed); }} /></label>;
              })}</div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
