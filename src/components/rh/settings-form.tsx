'use client';

import { useState, type FormEvent } from 'react';

import { FormError } from '@/components/rh/form-kit';
export function RhSettingsForm({ initial }: { initial: number | null }) {
  const [value, setValue] = useState(initial === null ? '' : String(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/rh/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacationDaysPerYear: value === '' ? null : value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      setMessage('Configuração guardada.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor="vacation-days" className="app-label">Direito anual de férias (dias)</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="vacation-days" type="number" min="0" max="365" className="app-input sm:max-w-40" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Não definido" />
        <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : 'Guardar'}</button>
      </div>
      <p className="mt-2 text-xs text-[#708195]">Deixar vazio para não aplicar saldo (fica apenas o histórico de dias).</p>
      {message && <p role="status" className="mt-2 text-xs font-medium text-[#267256]">{message}</p>}
      <FormError>{error}</FormError>
    </form>
  );
}
