import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Academia Machine | Conhecimento prático sobre facturação e gestão em Angola',
  description: 'Artigos originais e práticos sobre facturação, orçamentos, proformas, SAFT e boas práticas para empresas angolanas.',
  keywords: ['academia facturação Angola', 'guias empresariais Angola', 'facturação prática', 'gestão empresarial Angola'],
  alternates: {
    canonical: 'https://machinefaturas.shop/academia',
  },
  openGraph: {
    title: 'Academia Machine | Facturação e gestão em Angola',
    description: 'Conhecimento prático e sem complicações para empresas que operam em Angola.',
    locale: 'pt_AO',
    type: 'website',
    url: 'https://machinefaturas.shop/academia',
  },
};

const artigos = [
  {
    slug: 'diferenca-entre-orcamento-factura-proforma-e-factura',
    titulo: 'Diferença entre orçamento, factura proforma e factura em Angola',
    descricao: 'Aprenda quando usar cada um destes documentos, quais as diferenças práticas e como evitar confusões com clientes.',
    categoria: 'Documentos',
    tempoLeitura: '6 min',
  },
  {
    slug: 'erros-comuns-ao-emitir-facturas-em-angola',
    titulo: 'Erros comuns ao emitir facturas em Angola (e como evitá-los)',
    descricao: 'Os deslizes mais frequentes na prática, com dicas simples para manter as facturas organizadas e menos propensas a correções.',
    categoria: 'Facturação',
    tempoLeitura: '7 min',
  },
];

export default async function AcademiaPage() {
  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch {
    adHtml = null;
  }

  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
      <SiteHeader />
      {adHtml && (
        <div className="mx-auto max-w-4xl px-4 pt-5 md:px-6">
          <div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2">
            <AdHtml html={adHtml} />
          </div>
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Academia Machine</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Conhecimento prático para facturar e gerir melhor</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#4a5f76]">
          Artigos originais, escritos em português de Angola, com foco em situações reais do dia-a-dia. Sem jargão desnecessário, com dicas práticas
          e sempre com a devida prudência sobre temas fiscais.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {artigos.map((artigo) => (
            <article key={artigo.slug} className="rounded-2xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] transition hover:border-[#c9def2] hover:shadow-[0_8px_28px_rgba(25,52,80,.07)]">
              <div className="flex items-center justify-between text-xs text-[#708195]">
                <span className="rounded-full bg-[#eef6ff] px-2.5 py-1 font-semibold text-[#2878d0]">{artigo.categoria}</span>
                <span>{artigo.tempoLeitura} de leitura</span>
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight">
                <Link href={`/academia/${artigo.slug}`} className="transition hover:text-[#2878d0]">
                  {artigo.titulo}
                </Link>
              </h2>
              <p className="mt-2 leading-6 text-[#4a5f76]">{artigo.descricao}</p>
              <Link href={`/academia/${artigo.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2878d0] hover:underline">
                Ler artigo
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-[#d8e6f5] bg-[#eef6ff] p-6">
          <h2 className="text-lg font-bold">Ferramentas gratuitas para usar já</h2>
          <p className="mt-2 text-sm leading-6 text-[#4a5f76]">
            Põe em prática o que leres com as calculadoras e geradores do Machine Facturas, sem registo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/ferramentas/iva" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[#2878d0] ring-1 ring-[#c9def2] hover:bg-[#f6f9fc]">Calculadora de IVA</Link>
            <Link href="/ferramentas/orcamento-pdf" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[#2878d0] ring-1 ring-[#c9def2] hover:bg-[#f6f9fc]">Gerador de Orçamentos</Link>
            <Link href="/ferramentas/factura-proforma" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[#2878d0] ring-1 ring-[#c9def2] hover:bg-[#f6f9fc]">Factura Proforma</Link>
            <Link href="/ferramentas" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[#2878d0] ring-1 ring-[#c9def2] hover:bg-[#f6f9fc]">Ver todas as ferramentas</Link>
          </div>
        </div>

        <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
          <h2 className="text-2xl font-bold md:text-3xl">Do conhecimento à facturação</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">
            Quando chega a altura de emitir a factura definitiva, o Machine Facturas ajuda-te a fazê-lo de forma organizada.
          </p>
          <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">
            Criar conta grátis
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
