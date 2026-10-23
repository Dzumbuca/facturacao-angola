'use client';

import { useActionState } from 'react';
import { reviewPlanPayment } from '@/lib/admin-actions';

type ReviewState = { ok: boolean; message: string };

export function PlanPaymentReviewForm({ id, done }: { id: string; done: boolean }) {
  if (done) return null;
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(
    async (_previous: ReviewState, formData: FormData) => reviewPlanPayment(id, formData.get('decision') as 'CONFIRMADO' | 'REJEITADO', String(formData.get('note') ?? '')),
    { ok: false, message: '' },
  );

  return <form action={formAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
    <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
      <select name="decision" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue="CONFIRMADO" aria-label="Decisão">
        <option value="CONFIRMADO">Confirmar — activar Pro</option>
        <option value="REJEITADO">Rejeitar</option>
      </select>
      <input name="note" required minLength={3} maxLength={300} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Motivo (obrigatório, fica na auditoria)" />
    </div>
    <button type="submit" disabled={pending} className="min-h-9 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white transition hover:bg-[#1a3aa3] disabled:opacity-60">
      {pending ? 'A gravar…' : 'Gravar decisão'}
    </button>
    {state.message && <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.message}</p>}
  </form>;
}
