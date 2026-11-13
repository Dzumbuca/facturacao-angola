import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ToolPage } from '@/components/tool-page';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { FERRAMENTAS } from './tools-data';
import { ToolsHub } from './tools-hub';

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Centro de Ferramentas Empresariais — Grátis | Machine Facturas',
  description: 'Ferramentas grátis para empresas angolanas: calculadoras de IVA, salário líquido e IRT, lucro e margem, preço de venda, validador de NIF e geradores de documentos.',
  keywords: ['ferramentas para empresas Angola', 'calculadora IVA', 'calculadora salário Angola', 'lucro e margem', 'preço de venda', 'validador NIF', 'ferramentas grátis'],
  alternates: {
    canonical: 'https://machinefaturas.shop/ferramentas',
  },
  openGraph: {
    title: 'Centro de Ferramentas Empresariais — Machine Facturas',
    description: 'Calculadoras fiscais e financeiras grátis para o seu negócio em Angola.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function CentroFerramentasPage() {
  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch { adHtml = null; }


  return <ToolPage><main className="min-h-screen text-[var(--text)]">
    <SiteHeader />
    {adHtml && <div className="mx-auto max-w-6xl px-4 pt-5 md:px-6"><div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2 dark:border-[#1e2a44] dark:bg-[#0d1627]"><AdHtml html={adHtml} /></div></div>}

    <article className="mx-auto max-w-6xl px-4 py-10 md:px-6 lg:py-14">
      {/* Header */}
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cbe8dc] bg-[#eff9f4] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#227958] dark:border-[#1f3a2a] dark:bg-[#0e241b] dark:text-[#34d399]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
          GRÁTIS · Sem registo
        </span>
        <h1 className="mt-2 text-[34px] font-extrabold leading-[1.06] tracking-[-.02em] text-[var(--text)] sm:text-4xl">Centro de Ferramentas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">Ferramentas práticas para calcular, organizar e gerir melhor o seu negócio em Angola.</p>
      </header>

      <div className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-6 md:p-7">
        <ToolsHub ferramentas={FERRAMENTAS} />
      </div>

      {/* Sobre + Como usar (duas colunas) */}
      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr] items-start">
        <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-extrabold text-[var(--text)]">Sobre o Centro de Ferramentas</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
            O Centro de Ferramentas do Machine Facturas reúne calculadoras e geradores gratuitos para empresas angolanas. São pensados para uso rápido, sem registo,
            com explicações práticas e ligações aos guias e à <Link href="/academia" className="font-semibold text-[#021f87] underline underline-offset-2 hover:text-[#0634b8] dark:text-[#8aa4ff]">Academia Machine</Link>.
          </p>
        </div>
        <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-extrabold text-[var(--text)]">Como usar</h2>
          <ol className="mt-3 space-y-3">
            {[
              { n: 1, title: 'Escolhe a ferramenta', desc: 'pela categoria ou pela pesquisa.' },
              { n: 2, title: 'Preenche os dados', desc: 'campos reais do teu negócio.' },
              { n: 3, title: 'Consulta e aplica', desc: 'o resultado, ou exporta em PDF.' },
            ].map((step) => (
              <li key={step.n} className="flex items-start gap-3">
                <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#dbe2ff] bg-[#eef2ff] text-[11px] font-extrabold text-[#021f87] dark:border-[#1e2a44] dark:bg-[#0d1730] dark:text-[#8aa4ff]">{step.n}</span>
                <div>
                  <p className="text-[13px] font-bold text-[var(--text)]">{step.title}</p>
                  <p className="text-xs leading-5 text-[var(--text-muted)]">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Aprende e pratica — cartões reais */}
      <section aria-labelledby="aprende-title" className="mt-12">
        <h2 id="aprende-title" className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--text-muted)]">Aprende e pratica</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {[
            { href: '/guias/emitir-facturas', title: 'Como emitir facturas', desc: 'O fluxo completo de emissão, da criação ao envio.', tag: 'Guia', accent: '#021f87', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>) },
            { href: '/guias/saft', title: 'SAFT-AO', desc: 'Como gerar e submeter o ficheiro de auditoria.', tag: 'Guia', accent: '#267256', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>) },
            { href: '/academia', title: 'Academia Machine', desc: 'Artigos e explicações para empresas angolanas.', tag: 'Academia', accent: '#5b34d6', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16M6 16V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v11"/><path d="M8 8h6M8 12h6"/></svg>) },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group flex items-start gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-[1px] hover:border-[#021f87]">
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ring-1 ring-[var(--line)]" style={{ color: item.accent, background: `${item.accent}14` }}>{item.icon}</span>
              <span className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">{item.tag}</span>
                <span className="mt-0.5 block font-extrabold text-[var(--text)] transition group-hover:text-[#021f87] dark:group-hover:text-[#8aa4ff]">{item.title}</span>
                <span className="mt-1 block text-[13px] leading-5 text-[var(--text-muted)]">{item.desc}</span>
                <span className="mt-2 inline-block text-xs font-semibold text-[#021f87] underline underline-offset-2 dark:text-[#8aa4ff]">Ler conteúdo →</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <div className="mt-12 rounded-[20px] border border-[var(--line)] bg-gradient-to-br from-[#021f87] to-[#0634b8] px-6 py-8 text-center text-white shadow-[0_18px_42px_rgba(2,31,135,.35)] md:px-10">
        <h2 className="text-xl font-extrabold md:text-2xl">Queres isto tudo dentro do teu negócio?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#b9d0ff]">No Machine Facturas, as facturas saem com o IVA calculado, assinadas e numeradas automaticamente. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-white px-7 text-sm font-extrabold text-[#041f52] transition hover:bg-[#e8edff]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main></ToolPage>;
}
