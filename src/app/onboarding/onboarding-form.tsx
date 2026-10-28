'use client';

import { FormEvent, useState } from 'react';

export default function OnboardingForm({ userName, userEmail }: { userName?: string | null; userEmail?: string | null }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const tenantName = String(form.get('tenantName') ?? '').trim();
    const nif = String(form.get('nif') ?? '').trim().toUpperCase();

    try {
      const response = await fetch('/api/onboarding/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName, nif: nif || undefined }),
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
        <span className="app-label">Conta</span>
        <p className="rounded-lg border border-[#e2e9f1] bg-[#f7f9fc] px-3 py-2.5 text-sm text-[#344256]">
          {userName ? <strong className="font-semibold">{userName}</strong> : null}
          {userEmail ? <span className={userName ? 'block text-xs text-[#708195]' : ''}>{userEmail}</span> : null}
          {!userName && !userEmail ? 'Sessão iniciada' : <span className="sr-only">Dados recolhidos automaticamente da conta Google.</span>}
        </p>
        <p className="mt-1 text-xs text-[#708195]">Nome e email vieram da sua conta Google — nada para preencher aqui.</p>
      </div>
      <div>
        <label htmlFor="tenantName" className="app-label">Nome da empresa</label>
        <input id="tenantName" name="tenantName" type="text" autoComplete="organization" required maxLength={160} className="app-input" />
      </div>
      <div>
        <label htmlFor="nif" className="app-label">NIF da empresa <span className="font-normal text-[#708195]">(opcional)</span></label>
        <input id="nif" name="nif" type="text" inputMode="numeric" autoComplete="off" maxLength={14} pattern="(\d{10}|\d{9}[A-Za-z]{2}\d{3})?" title="10 dígitos, ou 9 dígitos + 2 letras + 3 dígitos. Pode deixar vazio." className="app-input" placeholder="Ex.: 5417089312" />
        <p className="mt-1.5 text-xs text-[#708195]">Pode deixar vazio e preencher depois no perfil da empresa.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
      <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-[#2878d0] px-4 py-3 font-semibold text-white transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60">
        {loading ? 'A criar…' : 'Criar espaço da empresa'}
      </button>
    </form>
  );
}
