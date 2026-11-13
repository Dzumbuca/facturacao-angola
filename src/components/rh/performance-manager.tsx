'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError, CalendarField } from '@/components/rh/form-kit';
type Criterion = { id: string; name: string; weight: number; order: number };
type Review = { id: string; reviewerName: string | null; score: number | null; comments: string | null; status: string; employee: { firstName: string; lastName: string; employeeNumber: string; position: { title: string } | null } };
type Cycle = { id: string; name: string; startsAt: string; endsAt: string | null; status: string; criteria: Criterion[]; reviews: Review[]; _count: { reviews: number } };

const STATUS: Record<string, string> = { PENDENTE: 'Pendente', ENTREGUE: 'Entregue', VALIDADO: 'Validado' };
const TONE: Record<string, string> = { PENDENTE: 'bg-[#fff7e6] text-[#8a5a00]', ENTREGUE: 'bg-[#eef2ff] text-[#37379e]', VALIDADO: 'bg-[#eff9f4] text-[#267256]' };

export function PerformanceManager({ cycles }: { cycles: Cycle[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [startsAtIso, setStartsAtIso] = useState('');
  const [endsAtIso, setEndsAtIso] = useState('');
  const [busy, setBusy] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { score: string; comments: string; reviewerName: string }>>({});

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('create'); setError('');
    try {
      const criteria = String(form.get('criteria') ?? '')
        .split('\n').map((line) => line.trim()).filter(Boolean)
        .map((line) => {
          const [name, weight] = line.split('|').map((part) => part.trim());
          return { name, weight: Number.isInteger(Number(weight)) && Number(weight) > 0 ? Number(weight) : 1 };
        });
      const response = await fetch('/api/rh/performance/cycles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: String(form.get('name') ?? ''), startsAt: String(form.get('startsAt') ?? ''), endsAt: String(form.get('endsAt') ?? '') || undefined, criteria }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível criar o ciclo.');
      event.currentTarget.reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function generate(cycleId: string) {
    setBusy(cycleId + ':gen'); setError('');
    try {
      const response = await fetch(`/api/rh/performance/cycles/${cycleId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível gerar.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function closeCycle(cycleId: string) {
    setBusy(cycleId + ':close'); setError('');
    try {
      const response = await fetch(`/api/rh/performance/cycles/${cycleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      if (!response.ok) throw new Error('Não foi possível fechar o ciclo.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function saveReview(reviewId: string, status: 'ENTREGUE' | 'VALIDADO') {
    const draft = drafts[reviewId] ?? { score: '', comments: '', reviewerName: '' };
    setBusy(reviewId + status); setError('');
    try {
      const body: any = { status };
      if (draft.score.trim() !== '') body.score = Number(draft.score);
      if (draft.comments.trim() !== '') body.comments = draft.comments.trim();
      if (draft.reviewerName.trim() !== '') body.reviewerName = draft.reviewerName.trim();
      const response = await fetch(`/api/rh/performance/reviews/${reviewId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[var(--text-muted)]">Desenvolvimento humano</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Avaliação de desempenho</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Ciclos configuráveis com critérios, pontuação 0–100 e validação.</p>
      </div>

      <FormError>{error}</FormError>

            <form onSubmit={createCycle} className="rounded-xl border border-[var(--line)] bg-white p-4">
        <h2 className="text-sm font-bold text-[var(--text)]">Novo ciclo</h2>
        <FormSection title="Ciclo de avaliação">
          <div className="sm:col-span-2">
            <FormField label="Nome" name="pc-name" required><input id="pc-name" name="name" className="ds-input" required placeholder="Ex.: Avaliação semestral 2026" /></FormField>
          </div>
          <div>
            <FormField label="Início" name="pc-start" required><CalendarField id="pc-start" name="startsAt" value={startsAtIso} onChange={setStartsAtIso} required /></FormField>
          </div>
          <div>
            <FormField label="Fim" name="pc-end"><CalendarField id="pc-end" name="endsAt" value={endsAtIso} onChange={setEndsAtIso} /></FormField>
          </div>
          <div className="sm:col-span-3">
            <FormField label="Critérios" name="pc-criteria" hint="Um por linha, formato «nome|peso»">
              <textarea id="pc-criteria" name="criteria" className="app-input min-h-24 font-mono text-xs" placeholder={'Produtividade|2 | Qualidade|2 | Colaboração|1'} />
            </FormField>
          </div>
          <div className="sm:col-span-3">
            <FormActions saving={busy === 'create'} onCancel={() => {}} saveLabel={busy === 'create' ? 'A criar…' : 'Criar ciclo'} />
          </div>
        </FormSection>
      </form>

      {cycles.map((cycle) => (
        <section key={cycle.id} className="rounded-xl border border-[var(--line)] bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-[#eef2f6] px-4 py-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-[var(--text)]">{cycle.name}</h2>
              <p className="text-xs text-[var(--text-muted)]">{new Date(cycle.startsAt).toLocaleDateString('pt-AO')}{cycle.endsAt ? ` → ${new Date(cycle.endsAt).toLocaleDateString('pt-AO')}` : ''} · {cycle._count.reviews} avaliações · {cycle.status === 'ABERTO' ? 'Aberto' : 'Fechado'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cycle.status === 'ABERTO' && (
                <>
                  <button type="button" onClick={() => generate(cycle.id)} disabled={busy.startsWith(cycle.id)} className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue)] disabled:opacity-50">{busy === cycle.id + ':gen' ? 'A gerar…' : `Gerar para todos (${cycles.reduce((sum, item) => sum + item._count.reviews, 0)})`}</button>
                  <button type="button" onClick={() => closeCycle(cycle.id)} disabled={busy.startsWith(cycle.id)} className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[#a83939] disabled:opacity-50">Fechar ciclo</button>
                </>
              )}
            </div>
          </div>
          {cycle.criteria.length > 0 && (
            <p className="border-b border-[#eef2f6] px-4 py-2 text-[11px] text-[var(--text-muted)]">Critérios: {cycle.criteria.map((c) => `${c.name} (${c.weight})`).join(' · ')}</p>
          )}
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead><tr><th>Funcionário</th><th>Cargo</th><th>Avaliador / nota</th><th>Comentários</th><th>Estado</th><th>Acções</th></tr></thead>
              <tbody>
                {cycle.reviews.map((review) => {
                  const draft = drafts[review.id] ?? { score: review.score?.toString() ?? '', comments: review.comments ?? '', reviewerName: review.reviewerName ?? '' };
                  const setDraft = (patch: Partial<typeof draft>) => setDrafts({ ...drafts, [review.id]: { ...draft, ...patch } });
                  return (
                    <tr key={review.id}>
                      <td data-mobile-primary className="font-semibold text-[var(--text)]">{review.employee.firstName} {review.employee.lastName} <span className="text-xs text-[var(--text-muted)]">{review.employee.employeeNumber}</span></td>
                      <td className="text-xs">{review.employee.position?.title ?? '—'}</td>
                      <td>
                        <div className="flex max-w-[240px] flex-col gap-1">
                          <input aria-label="Avaliador" placeholder="Avaliador" value={draft.reviewerName} onChange={(e) => setDraft({ reviewerName: e.target.value })} className="app-input !min-h-8 !py-1 text-xs" />
                          <input aria-label="Nota 0-100" type="number" min={0} max={100} placeholder="0–100" value={draft.score} onChange={(e) => setDraft({ score: e.target.value })} className="app-input !min-h-8 !py-1 text-xs" />
                        </div>
                      </td>
                      <td><textarea aria-label="Comentários" placeholder="Comentários…" value={draft.comments} onChange={(e) => setDraft({ comments: e.target.value })} className="app-input min-h-12 w-full max-w-[260px] !py-1 text-xs" /></td>
                      <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[review.status] ?? ''}`}>{STATUS[review.status] ?? review.status}</span></td>
                      <td data-mobile-actions>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => saveReview(review.id, 'ENTREGUE')} disabled={busy.startsWith(review.id)} className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue)] disabled:opacity-50">Entregar</button>
                          <button type="button" onClick={() => saveReview(review.id, 'VALIDADO')} disabled={busy.startsWith(review.id)} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256] disabled:opacity-50">Validar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {cycle.reviews.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Sem avaliações. Clique «Gerar para todos».</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {cycles.length === 0 && <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sem ciclos. Crie o primeiro acima.</p>}
    </div>
  );
}