import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ToolPage } from '@/components/tool-page';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { FERRAMENTAS } from './tools-data';
import { ToolsHub } from './tools-hub';

// Anúncios actualizam a cada 60s sem novo deploy
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

  return <ToolPage><main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    <SiteHeader />
    {adHtml && <div className="mx-auto max-w-4xl px-4 pt-5 md:px-6"><div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2"><AdHtml html={adHtml} /></div></div>}

    <article className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Grátis, sem registo</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Centro de Ferramentas</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#4a5f76]">Ferramentas práticas para calcular, organizar e gerir melhor o seu negócio em Angola.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[var(--shadow-card)] md:p-8">
        <ToolsHub ferramentas={FERRAMENTAS} />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Fiscalidade</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">IVA, salário líquido com IRT e validação de NIF, com as taxas em vigor em Angola.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Gestão financeira</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Lucro, margem, markup, preço de venda e indicadores para decidir melhor.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Documentos</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Orçamentos, facturas proforma, recibos e mapas de despesas em PDF — prontos a enviar.</p></div>
      </div>

      <section className="mt-10 rounded-2xl border border-[#e2e9f1] bg-white p-6 md:p-8">
        <h2 className="text-xl font-bold">Sobre o Centro de Ferramentas</h2>
        <p className="mt-2 leading-7 text-[#4a5f76]">
          O Centro de Ferramentas do Machine Facturas reúne calculadoras e geradores gratuitos para empresas angolanas. São pensados para uso rápido, sem registo,
          com explicações práticas e ligações aos guias e à <Link href="/academia" className="font-semibold text-[#2878d0] hover:underline">Academia Machine</Link>.
        </p>
        <h3 className="mt-6 font-bold">Como usar</h3>
        <ol className="mt-2 space-y-1 leading-7 text-[#4a5f76]">
          <li>1. Escolhe a ferramenta que precisares.</li>
          <li>2. Preenche os dados e obtém o resultado ou documento PDF.</li>
          <li>3. Usa as explicações e exemplos para aplicar ao teu negócio.</li>
        </ol>
        <h3 className="mt-6 font-bold">Categorias</h3>
        <p className="mt-2 leading-7 text-[#4a5f76]"><strong>Fiscalidade:</strong> IVA, salário líquido/IRT, validador de NIF. <strong>Gestão financeira:</strong> lucro/margem, preço de venda. <strong>Documentos empresariais:</strong> orçamentos, facturas proforma, recibos, mapa de despesas.</p>
      </section>

      <section className="mt-10 rounded-2xl border border-[#e2e9f1] bg-white p-6 md:p-8">
        <h2 className="text-xl font-bold">Aprende e pratica</h2>
        <p className="mt-2 leading-7 text-[#4a5f76]">Junta as ferramentas com os guias e artigos da Academia para facturar com mais confiança.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/guias/emitir-facturas" className="rounded-lg bg-[#eef6ff] px-3 py-1.5 text-sm font-semibold text-[#2878d0] hover:bg-[#e6f2ff]">Guia: Como emitir facturas</Link>
          <Link href="/guias/saft" className="rounded-lg bg-[#eef6ff] px-3 py-1.5 text-sm font-semibold text-[#2878d0] hover:bg-[#e6f2ff]">Guia: SAFT-AO</Link>
          <Link href="/academia" className="rounded-lg bg-[#eef6ff] px-3 py-1.5 text-sm font-semibold text-[#2878d0] hover:bg-[#e6f2ff]">Academia Machine</Link>
        </div>
      </section>

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Quer isto tudo dentro do seu negócio?</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">No Machine Facturas, as facturas saem com o IVA calculado, assinadas e numeradas automaticamente. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main></ToolPage>;
}
