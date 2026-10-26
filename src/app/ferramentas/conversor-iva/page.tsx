import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { ConversorIva } from './converter';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Conversor de IVA em Angola | Machine Facturas',
  description: 'Converta grátis valores com IVA incluído ou excluído: adicione ou retire o IVA de 14%, 7%, 2% ou 0% em kwanzas, nos dois sentidos. Sem registo.',
  keywords: ['conversor IVA Angola', 'retirar IVA de um valor', 'acrescentar IVA', 'IVA incluído', 'calcular IVA 14%'],
  openGraph: {
    title: 'Conversor de IVA — Angola',
    description: 'Adicione ou retire o IVA em kwanzas, nos dois sentidos. Grátis e instantâneo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function ConversorIvaPage() {
  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch { adHtml = null; }

  return <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    {adHtml && <div className="mx-auto max-w-4xl px-4 pt-5 md:px-6"><div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2"><AdHtml html={adHtml} /></div></div>}

    <article className="prose-machine mx-auto max-w-3xl px-4 py-12 md:px-6">
      <BackToHub />
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Ferramenta grátis</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Conversor de IVA</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Tem um valor com IVA e quer saber quanto é sem IVA? Ou o contrário? O conversor trabalha nos dois sentidos, com as taxas legais de Angola. Resultados instantâneos, sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <ConversorIva />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Modo A — adicionar</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Parte de um valor sem IVA e mostra o IVA a cobrar e o total com IVA. Ideal para preparar facturas.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Modo B — retirar</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Parte de um valor total e separa a parte que é IVA. Cuidado: o IVA não se tira multiplicando — divide-se.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Taxas legais</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">14% (taxa geral), 7% (reduzida), 2% (especial) e 0% (isento). Confirme sempre a lista vigente junto da AGT.</p></div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Fórmulas utilizadas</h2>
      <ul>
        <li>Modo A — Valor do IVA = valor sem IVA × taxa ÷ 100 · Total = valor sem IVA + IVA</li>
        <li>Modo B — Valor sem IVA = total com IVA ÷ (1 + taxa ÷ 100) · IVA incluído = total − valor sem IVA</li>
      </ul>
      <p>No modo B, dividir é essencial: retirar 14% multiplicando por 0,14 dá um resultado errado, porque a taxa incide sobre o valor sem IVA e não sobre o total.</p>

      <h2 className="mt-10 text-2xl font-bold">Exemplo de cálculo</h2>
      <p>Uma factura de 114.000 Kz já com IVA de 14% incluído (modo B):</p>
      <ul>
        <li>Valor sem IVA: 114.000 ÷ 1,14 = <strong>100.000 Kz</strong></li>
        <li>IVA incluído no total: 114.000 − 100.000 = <strong>14.000 Kz</strong></li>
      </ul>
      <p>No sentido inverso (modo A), 100.000 Kz a 14% dá 14.000 Kz de IVA e um total de 114.000 Kz.</p>

      <RelatedTools actualId="conversor-iva" categoria="Fiscalidade" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">E se as facturas saíssem já com o IVA?</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">No Machine Facturas, o IVA é calculado, destacado e declarado automaticamente em cada factura. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main>;
}
