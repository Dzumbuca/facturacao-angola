'use client';

import { useState, type FormEvent } from 'react';

import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
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
      <FormSection title="Direito de férias">
        <FormField label="Direito anual de férias" name="vacation-days" hint="Deixar vazio não aplica saldo">
          <div className="flex gap-2">
            <input id="vacation-days" type="number" min="0" max="365" className="app-input sm:max-w-40" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Não definido" />
            <FormActions saving={saving} onCancel={() => {}} saveLabel={saving ? 'A guardar…' : 'Guardar'} />
          </div>
        </FormField>
      </FormSection>
      <p className="mt-2 text-xs text-[#708195]">Deixar vazio para não aplicar saldo (fica apenas o histórico de dias).</p>
      {message && <p role="status" className="mt-2 text-xs font-medium text-[#267256]">{message}</p>}
      <FormError>{error}</FormError>
    </form>
  );
}
