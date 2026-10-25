'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const tenantName = String(form.get('tenantName') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    const marketingConsent = form.get('marketingConsent') === 'on';

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tenantName, email, password, marketingConsent }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Não foi possível criar a conta.');
        return;
      }

      sessionStorage.setItem('registrationEmail', email);
      setSubmitted(true);
      router.push('/check-email');
    } catch {
      setError('Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-stretch bg-[#f3f6fa] text-[#1c2d3f] md:p-6">
      <div className="mx-auto flex w-full max-w-6xl overflow-hidden bg-white md:min-h-[min(760px,calc(100vh-3rem))] md:rounded-3xl md:border md:border-[#e2e9f1] md:shadow-[0_20px_60px_rgba(25,52,80,.09)]">
      <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#102b46] p-10 text-white md:flex lg:p-14">
        <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full border border-white/10"/><div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full border border-white/10"/>
        <Link href="/register" className="relative flex items-center gap-3"><img src="/logo.png" width="800" height="600" alt="Facturas" className="h-11 w-auto max-w-[120px] rounded-xl bg-white object-contain px-2 py-1.5" /><span className="text-sm font-extrabold tracking-[.12em]">FACTURAÇÃO<br/><span className="text-xs font-medium tracking-[.2em] text-blue-200">ANGOLA</span></span></Link>
        <div className="relative max-w-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#78c8d0]">Comece por aqui</p><h2 className="mt-4 text-4xl font-bold leading-tight">Uma base simples para o seu negócio.</h2><p className="mt-4 leading-7 text-blue-100/75">Crie o espaço da sua empresa e comece a organizar a sua facturação.</p></div>
        <p className="relative text-xs text-blue-100/85">Plataforma de facturação · Angola</p>
      </aside>
      <section className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 md:w-[58%] md:px-14 lg:px-20">
        <Link href="/register" className="mb-7 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#2878d0] md:hidden"><img src="/logo.png" width="800" height="600" alt="Facturas" className="h-8 w-auto max-w-[84px] rounded-lg bg-white object-contain px-1.5 py-1" /> Facturação Angola</Link>
        {submitted ? <p role="status" className="mb-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Se o registo puder ser concluído, enviaremos instruções para o endereço indicado.</p> : <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Novo espaço de trabalho</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Criar a sua conta</h1>
          <p className="mt-2 text-sm leading-6 text-[#708195]">Registe os seus dados e os da sua empresa para começar a emitir facturas.</p>
        </div>}

        {!submitted && <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="app-label">O seu nome</label>
            <input id="name" name="name" type="text" autoComplete="name" required maxLength={120} className="app-input" />
          </div>
          <label className="flex items-start gap-2 text-sm leading-5 text-[#708195]"><input name="marketingConsent" type="checkbox" className="mt-1"/><span>Quero receber novidades e comunicações comerciais da Machine Facturas. Posso cancelar a subscrição a qualquer momento.</span></label>
          <div>
            <label htmlFor="tenantName" className="app-label">Nome da empresa</label>
            <input id="tenantName" name="tenantName" type="text" autoComplete="organization" required maxLength={160} className="app-input" />
          </div>
          <div>
            <label htmlFor="email" className="app-label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="app-input" />
          </div>
          <div>
            <label htmlFor="password" className="app-label">Criar palavra-passe</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="app-input" />
            <p className="mt-1.5 text-xs text-[#708195]">Use pelo menos 8 caracteres.</p>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
          <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-[#2878d0] px-4 py-3 font-semibold text-white transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60">
            {loading ? 'A criar a conta…' : 'Criar conta'}
          </button>
        </form>}

        {!submitted && process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === 'true' && (
          <>
            <div className="mt-5 flex items-center gap-3 text-xs text-[#708195]" aria-hidden="true">
              <span className="h-px flex-1 bg-[#e7edf3]" /> ou <span className="h-px flex-1 bg-[#e7edf3]" />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#d7dee8] bg-white px-4 py-3 font-semibold text-[#1c2d3f] transition hover:bg-[#f6f9fc] disabled:cursor-wait disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              Criar conta com Google
            </button>
            <p className="mt-2 text-center text-xs text-[#708195]">Depois de entrar, indique o nome da sua empresa.</p>
          </>
        )}

        <p className="mt-6 border-t border-[#e7edf3] pt-5 text-center text-sm text-[#708195]">
          Já tem conta?{' '}
          <Link href="/login" className="font-semibold text-[#2878d0] hover:underline">Iniciar sessão</Link>
        </p>
      </section>
      </div>
    </main>
  );
}
