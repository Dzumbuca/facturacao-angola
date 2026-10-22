'use client';

import { FormEvent, useState } from 'react';

export default function OnboardingForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const tenantName = String(form.get('tenantName') ?? '').trim();

    try {
      const response = await fetch('/api/onboarding/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? 'Não foi possível criar o espaço da empresa.');
        return;
      }
      // Reemite a sessão com o tenantId novo para o proxy deixar entrar.
      await fetch('/api/session/refresh', { method: 'POST' }).catch(() => null);
      window.location.assign('/');
    } catch {
      setError('Não foi possível comunicar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="tenantName" className="app-label">Nome da empresa</label>
        <input id="tenantName" name="tenantName" type="text" autoComplete="organization" required maxLength={160} className="app-input" />
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
      <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-[#2878d0] px-4 py-3 font-semibold text-white transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60">
        {loading ? 'A criar…' : 'Criar espaço da empresa'}
      </button>
    </form>
  );
}
