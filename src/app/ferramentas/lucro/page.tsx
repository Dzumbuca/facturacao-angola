import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { LucroCalculator } from './calculator';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Calculadora de Lucro e Margem de Lucro | Machine Facturas',
  description: 'Calcule grátis o lucro, a margem e o markup de cada produto em kwanzas. Veja claramente quando está a vender com prejuízo — sem registo.',
  keywords: ['calculadora de lucro Angola', 'margem de lucro', 'markup', 'lucro unitário', 'calcular lucro kwanzas'],
  openGraph: {
    title: 'Calculadora de Lucro e Margem — Angola',
    description: 'Lucro, margem e markup de cada produto, em kwanzas. Grátis e instantâneo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function CalculadoraLucroPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Calculadora de Lucro e Margem</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Descubra quanto ganha (ou perde) em cada produto, com a margem e o markup calculados automaticamente em kwanzas. Resultados instantâneos, sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <LucroCalculator />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Margem não é markup</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">A margem compara o lucro com o preço de venda; o markup compara com o custo. Os dois indicadores aparecem sempre separados nesta ferramenta.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Todo o custo conta</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Some ao custo de compra o transporte, embalagem e outros custos por unidade — só assim a margem reflecte a realidade.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Prejuízo bem visível</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Se o preço de venda for inferior ao custo total, a ferramenta avisa de imediato e mostra o quanto perde por unidade.</p></div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Fórmulas utilizadas</h2>
      <ul>
        <li>Custo total unitário = custo de aquisição + outros custos por unidade</li>
        <li>Lucro unitário = preço de venda − custo total unitário</li>
        <li>Margem de lucro (%) = lucro unitário ÷ preço de venda × 100</li>
        <li>Markup (%) = lucro unitário ÷ custo total unitário × 100</li>
        <li>Lucro total = lucro unitário × quantidade vendida</li>
      </ul>
      <p>Quando o preço de venda é zero, a margem não existe (divisão inválida) e a ferramenta mostra o traço em vez de um número falso. Quando o custo total é zero, o mesmo acontece com o markup.</p>

      <h2 className="mt-10 text-2xl font-bold">Exemplo de cálculo</h2>
      <p>Um comerciante compra cada saco de arroz por 3.500 Kz e gasta 250 Kz em transporte. Vende cada saco a 5.000 Kz:</p>
      <ul>
        <li>Custo total unitário: 3.500 + 250 = <strong>3.750 Kz</strong></li>
        <li>Lucro unitário: 5.000 − 3.750 = <strong>1.250 Kz</strong></li>
        <li>Margem: 1.250 ÷ 5.000 = <strong>25%</strong> do preço de venda</li>
        <li>Markup: 1.250 ÷ 3.750 = <strong>33,3%</strong> sobre o custo</li>
        <li>Vendendo 40 sacos: 1.250 × 40 = <strong>50.000 Kz</strong> de lucro total</li>
      </ul>

      <RelatedTools actualId="lucro" categoria="Gestão Financeira" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Cansado de calcular à mão?</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">O Machine Facturas calcula o IVA, assina e numera as suas facturas automaticamente. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main>;
}
