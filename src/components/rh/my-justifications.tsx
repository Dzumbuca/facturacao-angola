'use client';

import { useState, type FormEvent } from 'react';

type Item = { id: string; date: string; type: string; reason: string; status: string; decisionNote: string | null };

const STATUS: Record<string, string> = { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado' };
const TONE: Record<string, string> = {
  PENDENTE: 'bg-[#fff7e6] text-[#8a5a00]', APROVADO: 'bg-[#eff9f4] text-[#267256]', REJEITADO: 'bg-[#fdf3f3] text-[#a83939]',
};

export function MyJustifications({ items, canSubmit }: { items: Item[]; canSubmit: boolean }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/meu-rh/justifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: String(form.get('date') ?? ''),
          type: String(form.get('type') ?? ''),
          reason: String(form.get('reason') ?? ''),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível submeter.');
      setMessage('Justificação submetida. Aguarda análise do RH.');
      setOpen(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#e1e8f0] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef2f6] px-4 py-3">
        <h2 className="text-sm font-bold text-[#1c2d3f]">Justificações</h2>
        {canSubmit && !open && (
          <button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-9 rounded-lg bg-[#021f87] px-3 text-xs font-semibold text-white">
            Nova justificação
          </button>
        )}
      </div>

      {open && canSubmit && (
        <form onSubmit={submit} className="border-b border-[#eef2f6] bg-[#f9fbfe] px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="mj-date" className="app-label">Data *</label>
              <input id="mj-date" name="date" type="date" className="app-input" required />
            </div>
            <div>
              <label htmlFor="mj-type" className="app-label">Tipo *</label>
              <select id="mj-type" name="type" className="app-input" defaultValue="FALTA">
                <option value="FALTA">Falta</option>
                <option value="ATRASO">Atraso</option>
                <option value="SAIDA_ANTECIPADA">Saída antecipada</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div>
              <label htmlFor="mj-reason" className="app-label">Motivo *</label>
              <input id="mj-reason" name="reason" className="app-input" required maxLength={1000} />
            </div>
          </div>
          {error && <p role="alert" className="mt-2 text-xs font-medium text-[#a83939]">{error}</p>}
          {message && <p role="status" className="mt-2 text-xs font-medium text-[#267256]">{message}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#52667a]">Cancelar</button>
            <button type="submit" disabled={saving} className="min-h-9 rounded-lg bg-[#021f87] px-3 text-xs font-semibold text-white disabled:opacity-50">
              {saving ? 'A submeter…' : 'Submeter'}
            </button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-[#eef2f6]">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#1c2d3f]">{new Date(item.date).toLocaleDateString('pt-AO')} · {item.type}</p>
              <p className="text-xs text-[#52667a]">{item.reason}</p>
              {item.decisionNote && <p className="mt-0.5 text-[11px] text-[#708195]">Nota do RH: {item.decisionNote}</p>}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[item.status] ?? ''}`}>{STATUS[item.status] ?? item.status}</span>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#708195]">Sem justificações submetidas.</li>}
      </ul>
    </section>
  );
}