import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { PrecoVendaCalculator } from './calculator';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Calculadora de Preço de Venda | Machine Facturas',
  description: 'Defina grátis o preço de venda ideal: introduza os custos e a margem pretendida e receba o preço recomendado em kwanzas, com opção de arredondamento comercial.',
  keywords: ['calculadora preço de venda Angola', 'como definir preço de venda', 'margem de lucro preço', 'formar preço kwanzas'],
  openGraph: {
    title: 'Calculadora de Preço de Venda — Angola',
    description: 'Do custo à margem: o preço de venda recomendado em kwanzas. Grátis.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function CalculadoraPrecoVendaPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Calculadora de Preço de Venda</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Defina o preço certo para o seu produto: a partir dos custos e da margem pretendida, receba de imediato o preço recomendado em kwanzas — com opção de arredondamento comercial. Sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <PrecoVendaCalculator />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Custos completos</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Inclua o custo de compra e os outros custos por unidade — transportes e embalagem fazem parte do preço verdadeiro.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Margem realista</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">A margem tem de ser inferior a 100%. Valores típicos do comércio situam-se entre 10% e 40%, mas dependem do sector.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Preços comerciais</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">O arredondamento opcional transforma 1.428 Kz em 1.450 Kz — mais fácil de comunicar e de dar troco.</p></div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Fórmula utilizada</h2>
      <ul>
        <li>Custo total unitário = custo de aquisição + outros custos por unidade</li>
        <li>Preço de venda = custo total unitário ÷ (1 − margem pretendida ÷ 100)</li>
        <li>Lucro estimado por unidade = preço de venda − custo total unitário</li>
        <li>Lucro total = lucro por unidade × quantidade</li>
      </ul>
      <p>A fórmula exige uma margem inferior a 100% — com margem de 100% ou mais não existe preço possível, por isso a ferramenta bloqueia esses valores. Com o arredondamento activo, o preço é sempre arredondado para cima até ao múltiplo escolhido e a ferramenta recalcula o lucro e a margem efectiva.</p>

      <h2 className="mt-10 text-2xl font-bold">Exemplo de cálculo</h2>
      <p>Um produto custa 600 Kz já com despesas incluídas e o comerciante quer uma margem de 58%:</p>
      <ul>
        <li>Preço calculado: 600 ÷ (1 − 0,58) = <strong>1.428,57 Kz</strong></li>
        <li>Com arredondamento de 25 Kz: <strong>1.450 Kz</strong></li>
        <li>Lucro por unidade com o preço ajustado: 1.450 − 600 = <strong>850 Kz</strong></li>
        <li>Margem efectiva: 850 ÷ 1.450 = <strong>58,6%</strong> — ligeiramente acima da pretendida</li>
        <li>Vendendo 3 unidades: 850 × 3 = <strong>2.550 Kz</strong> de lucro estimado</li>
      </ul>
      <p>O preço recomendado é uma simulação baseada nos custos e na margem introduzidos — não é uma garantia de rentabilidade. Valide sempre com os preços praticados no seu mercado.</p>

      <RelatedTools actualId="preco-venda" categoria="Gestão Financeira" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Preços certos, facturas automáticas</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">No Machine Facturas, cada factura sai com o IVA calculado, assinada e numerada. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main>;
}
