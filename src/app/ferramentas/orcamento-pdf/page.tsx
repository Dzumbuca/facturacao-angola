import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ToolPage } from '@/components/tool-page';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { OrcamentoProformaForm } from '../doc-forms';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Gerador de Orçamentos em PDF — Grátis | Machine Facturas',
  description: 'Crie grátis orçamentos profissionais em PDF: itens, quantidades, preços e IVA em kwanzas, com subtotal e total calculados. Descarrega em segundos, sem registo.',
  keywords: ['gerador de orçamento PDF Angola', 'orçamento grátis', 'criar orçamento kwanzas', 'orçamento empresa Angola'],
  openGraph: {
    title: 'Gerador de Orçamentos em PDF — Angola',
    description: 'Orçamentos profissionais em PDF, com IVA e totais. Grátis e sem registo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function GeradorOrcamentoPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Gerador de Orçamentos em PDF</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Transforme a sua lista de itens num orçamento profissional em PDF: subtotal, IVA e total calculados automaticamente, em kwanzas. O ficheiro descarrega em segundos — sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <OrcamentoProformaForm tipo="orcamento" />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Totais automáticos</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Subtotal, IVA destacado e total calculados item a item — sem folha de cálculo.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Validade clara</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">O PDF indica por quantos dias o orçamento é válido, evitando mal-entendidos com o cliente.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Nada fica guardado</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">O PDF é gerado na hora e os dados não ficam no servidor — privacidade total.</p></div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Como o total é calculado</h2>
      <ul>
        <li>Subtotal = soma de (quantidade × preço unitário) de todos os itens</li>
        <li>IVA = subtotal × taxa ÷ 100 (quando escolhe destacar IVA)</li>
        <li>Total = subtotal + IVA</li>
      </ul>
      <p>Se preferir um orçamento sem imposto destacado, escolha «Sem IVA destacado» — o PDF mostra apenas o subtotal e o total.</p>

      <h2 className="mt-10 text-2xl font-bold">Exemplo</h2>
      <p>Um orçamento com 5 mesas a 12.000 Kz e 20 cadeiras a 3.500 Kz, com IVA de 14%:</p>
      <ul>
        <li>Subtotal: 60.000 + 70.000 = <strong>130.000 Kz</strong></li>
        <li>IVA (14%): <strong>18.200 Kz</strong></li>
        <li>Total: <strong>148.200 Kz</strong></li>
      </ul>

      <RelatedTools actualId="orcamento-pdf" categoria="Documentos Empresariais" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Do orçamento à factura num clique</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">No Machine Facturas, o orçamento aprovado transforma-se em factura com IVA, assinatura digital e numeração automática. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main></ToolPage>;
}
