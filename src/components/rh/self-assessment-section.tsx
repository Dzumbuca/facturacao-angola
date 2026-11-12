'use client';

import { useState, type FormEvent } from 'react';

import { FormError } from '@/components/rh/form-kit';
type Cycle = { id: string; name: string; startsAt: string; endsAt: string | null };

export function SelfAssessmentSection({ cycles, existing }: { cycles: Cycle[]; existing: Record<string, { selfScore: number | null; comments: string | null } | null> }) {
  const [selected, setSelected] = useState(cycles[0]?.id ?? '');
  const [selfScore, setSelfScore] = useState(existing[selected]?.selfScore?.toString() ?? '');
  const [comments, setComments] = useState(existing[selected]?.comments ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (cycles.length === 0) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/meu-rh/self-assessment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: selected,
          selfScore: selfScore.trim() === '' ? null : Number(selfScore),
          comments: comments.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      setMessage('Autoavaliação guardada. O RH pode consultá-la no ciclo.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#e1e8f0] bg-white p-4">
      <h2 className="text-sm font-bold text-[#1c2d3f]">Autoavaliação</h2>
      <p className="mt-0.5 text-xs text-[#607286]">Avalie o seu desempenho num ciclo aberto.</p>

      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sa-cycle" className="app-label">Ciclo</label>
          <select id="sa-cycle" className="app-input" value={selected} onChange={(e) => {
            const next = e.target.value;
            setSelected(next);
            setSelfScore(existing[next]?.selfScore?.toString() ?? '');
            setComments(existing[next]?.comments ?? '');
            setMessage('');
          }}>
            {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sa-score" className="app-label">Pontuação (0–100)</label>
          <input id="sa-score" type="number" min="0" max="100" className="app-input" value={selfScore} onChange={(e) => setSelfScore(e.target.value)} placeholder="Ex.: 80" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sa-comments" className="app-label">Comentários</label>
          <textarea id="sa-comments" className="app-input min-h-20" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="O que correu bem, o que pode melhorar…" />
        </div>
        <FormError>{error}</FormError>
        {message && <p role="status" className="sm:col-span-2 text-xs font-medium text-[#267256]">{message}</p>}
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : 'Guardar autoavaliação'}</button>
        </div>
      </form>
    </section>
  );
}