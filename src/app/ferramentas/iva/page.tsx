import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ToolPage } from '@/components/tool-page';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { IvaCalculator } from './calculator';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Calculadora de IVA 14% — Angola | Machine Facturas',
  description: 'Calculadora de IVA para Angola: simule o acréscimo ou a separação do imposto em kwanzas e confirme a taxa aplicável à sua operação.',
  keywords: ['calculadora IVA Angola', 'calcular IVA 14', 'IVA Angola', 'imposto sobre o valor acrescentado', 'calculadora de impostos Angola'],
  openGraph: {
    title: 'Calculadora de IVA 14% — Angola',
    description: 'Acrescente ou retire o IVA em Kwanzas. Grátis e instantâneo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function CalculadoraIvaPage() {
  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch { adHtml = null; }

  return <ToolPage><main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    {adHtml && <div className="mx-auto max-w-4xl px-4 pt-5 md:px-6"><div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2"><AdHtml html={adHtml} /></div></div>}

    <article className="prose-machine mx-auto max-w-3xl px-4 py-12 md:px-6">
      <BackToHub />
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Ferramenta grátis</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Calculadora de IVA — Angola</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Acrescente ou retire o IVA em Kwanzas, com a taxa geral de 14% ou as taxas reduzidas. Resultados instantâneos, sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <IvaCalculator />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Taxa geral: 14%</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Aplica-se à maioria dos bens e serviços em Angola, desde a entrada em vigor do IVA em 2023 (que substituiu o consumo).</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Taxas por enquadramento</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">A lei prevê também 7%, 5% e 1% para regimes e operações específicos. Confirme a taxa aplicável ao bem, serviço e localização junto da AGT.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Emissão automática</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">No Machine Facturas, o IVA é calculado e destacado automaticamente em cada factura, com assinatura digital.</p></div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#5b6f85]">Referência legal: <a className="font-semibold text-[#2878d0] underline" href="https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw4z/nzu5/~edisp/minfin3759673.pdf" target="_blank" rel="noreferrer">Código do IVA republicado pela Lei n.º 14/23, de 28 de Dezembro</a>. A calculadora não determina o enquadramento fiscal da operação.</p>

      <RelatedTools actualId="iva" categoria="Fiscalidade" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Cansado de calcular à mão?</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">O Machine Facturas calcula o IVA, assina e numera as suas facturas automaticamente. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main></ToolPage>;
}
