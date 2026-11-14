'use client';

import { useState, type FormEvent } from 'react';

import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
import { RhModuleHero } from '@/components/rh/premium-kit';
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
    <div className="space-y-4">
      <RhModuleHero
        eyebrow="Machine RH"
        title="Configurações"
        description="Configuração global do módulo RH. O direito anual de férias é o valor aplicado para cálculo de saldo em todos os pedidos aprovados."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>}
      />
    <form onSubmit={submit} className="mt-1">
      <FormSection title="Direito de férias">
        <FormField label="Direito anual de férias" name="vacation-days" hint="Deixar vazio não aplica saldo">
          <div className="flex gap-2">
            <input id="vacation-days" type="number" min="0" max="365" className="app-input sm:max-w-40" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Não definido" />
            <FormActions saving={saving} onCancel={() => {}} saveLabel={saving ? 'A guardar…' : 'Guardar'} />
          </div>
        </FormField>
      </FormSection>
      {message && <p role="status" className="mt-2 text-xs font-medium text-[#267256]">{message}</p>}
      <FormError>{error}</FormError>
    </form>
    </div>
  );
}
