import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { OrcamentoProformaForm } from '../doc-forms';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Gerador de Factura Proforma — Grátis | Machine Facturas',
  description: 'Crie grátis facturas proforma em PDF com itens, IVA e totais em kwanzas. Documento formal para cotações e encomendas — descarrega em segundos, sem registo.',
  keywords: ['factura proforma Angola', 'gerador proforma PDF', 'proforma grátis', 'cotação Angola'],
  openGraph: {
    title: 'Gerador de Factura Proforma — Angola',
    description: 'Facturas proforma em PDF com IVA e totais. Grátis e sem registo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function GeradorProformaPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Gerador de Factura Proforma</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Prepare facturas proforma em PDF com o aspecto de uma factura a sério: itens, IVA, totais e validade. Ideal para cotações, importação/exportação e formalização de encomendas — sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <OrcamentoProformaForm tipo="proforma" />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Sem valor fiscal</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">A proforma não substitui a factura com selo AGT — o próprio PDF indica-o claramente no rodapé.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Validade escolhida</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Escolha 7, 15 ou 30 dias de validade e o PDF comunica o prazo ao cliente.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Nada fica guardado</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">O PDF é gerado na hora e os dados não ficam no servidor — privacidade total.</p></div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Quando usar uma proforma</h2>
      <ul>
        <li>Para o cliente aprovar preços antes da factura definitiva</li>
        <li>Para processos de importação, bancos e documentos de encomenda</li>
        <li>Para fixar condições (preços, IVA e validade) por escrito</li>
      </ul>
      <p>Os totais calculam-se como na factura: subtotal (quantidade × preço), IVA destacado quando escolhido e total. A diferença é que a proforma não é documento fiscal e não entra nos livros de IVA.</p>

      <h2 className="mt-10 text-2xl font-bold">Exemplo</h2>
      <p>Uma proforma de serviço de transporte a 45.000 Kz, sem IVA destacado, com validade de 15 dias: o PDF mostra subtotal e total de <strong>45.000 Kz</strong> e a nota «Factura proforma — documento sem valor fiscal, não substitui a factura. Validade: 15 dias.»</p>

      <RelatedTools actualId="factura-proforma" categoria="Documentos Empresariais" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Proforma aprovada? Emita a factura a sério</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">No Machine Facturas, a factura definitiva sai com IVA, assinatura digital padrão AGT e numeração automática. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main>;
}
