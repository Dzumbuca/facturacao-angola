'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ThemeToggle } from '@/components/theme-toggle';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { setSignedOut(new URLSearchParams(window.location.search).get('logout') === '1'); }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await signIn('credentials', {
        email: form.get('email'),
        password: form.get('password'),
        redirect: false,
        callbackUrl: '/',
      });
      if (result?.error) {
        setError('Email ou palavra-passe incorrectos. Verifique os dados e tente novamente. Se ainda não confirmou o email, consulte a página de confirmação.');
      } else if (result?.url) {
        window.location.assign(result.url);
      }
    } catch {
      setError('Não foi possível iniciar sessão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-stretch bg-[#f3f6fa] text-[#1c2d3f] md:p-6">
      <div className="auth-theme-control"><ThemeToggle compact /></div>
      <div className="mx-auto flex w-full max-w-6xl overflow-hidden bg-white md:min-h-[min(760px,calc(100vh-3rem))] md:rounded-3xl md:border md:border-[#e2e9f1] md:shadow-[0_20px_60px_rgba(25,52,80,.09)]">
      <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#102b46] p-10 text-white md:flex lg:p-14">
        <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full border border-white/10"/><div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full border border-white/10"/>
        <Link href="/login" className="relative flex items-center gap-3"><img src="/logo.png" width="800" height="600" alt="Facturas" className="h-11 w-auto max-w-[120px] rounded-xl bg-white object-contain px-2 py-1.5" /><span className="text-sm font-extrabold tracking-[.12em]">FACTURAÇÃO<br/><span className="text-xs font-medium tracking-[.2em] text-blue-200">ANGOLA</span></span></Link>
        <div className="relative max-w-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#78c8d0]">Gestão financeira</p><h2 className="mt-4 text-4xl font-bold leading-tight">A sua facturação, organizada.</h2><p className="mt-4 leading-7 text-blue-100">Aceda ao espaço da sua empresa para gerir documentos, clientes e produtos.</p></div>
        <p className="relative text-xs text-blue-100">Plataforma de facturação · Angola</p>
      </aside>
      <section className="relative flex w-full flex-col justify-center px-6 py-12 sm:px-12 md:w-[58%] md:px-14 lg:px-20">
        <Link href="/inicio#precos" className="absolute top-5 right-20 hidden text-xs font-semibold text-[#48627a] hover:text-[#2878d0] md:inline">Ver planos e preços →</Link>
        <Link href="/login" className="mb-10 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#2878d0] md:hidden"><img src="/logo.png" width="800" height="600" alt="Facturas" className="h-8 w-auto max-w-[84px] rounded-lg bg-white object-contain px-1.5 py-1" /> Facturação Angola</Link>
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Bem-vindo de volta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Iniciar sessão</h1>
          <p className="mt-2 text-sm leading-6 text-[#708195]">Entre com o email e a palavra-passe da sua conta.</p>
          {signedOut && <p role="status" className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">Sessão terminada com sucesso.</p>}
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="app-label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="app-input" />
          </div>
          <div>
            <label htmlFor="password" className="app-label">Palavra-passe</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="app-input" />
            <Link href="/forgot-password" className="mt-2 inline-block text-sm font-semibold text-[#2878d0] hover:underline">Esqueci-me da palavra-passe</Link>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
          <button type="submit" disabled={loading} className="mt-1 min-h-12 w-full rounded-lg bg-[#2878d0] px-4 py-3 font-semibold text-white transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60">
            {loading ? 'A entrar…' : 'Entrar'}
          </button>
        </form>

        {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === 'true' && (
          <>
            <div className="mt-6 flex items-center gap-3 text-xs text-[#708195]" aria-hidden="true">
              <span className="h-px flex-1 bg-[#e7edf3]" /> ou <span className="h-px flex-1 bg-[#e7edf3]" />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#d7dee8] bg-white px-4 py-3 font-semibold text-[#1c2d3f] transition hover:bg-[#f6f9fc] disabled:cursor-wait disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              Continuar com Google
            </button>
          </>
        )}

        <p className="mt-7 border-t border-[#e7edf3] pt-6 text-center text-sm text-[#708195]">
          Ainda não tem conta?{' '}
          <Link href="/register" className="font-semibold text-[#2878d0] hover:underline">Criar conta</Link>
        </p>
      </section>
      </div>
    </main>
  );
}



