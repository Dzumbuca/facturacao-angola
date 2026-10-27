import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { ReciboForm } from './recibo-form';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Gerador de Recibos de Pagamento — Grátis | Machine Facturas',
  description: 'Emita grátis recibos de pagamento em PDF: valor em kwanzas em destaque, forma de pagamento, data e espaço para assinatura. Descarrega em segundos, sem registo.',
  keywords: ['recibo de pagamento Angola', 'gerador de recibo PDF', 'recibo grátis kwanzas', 'modelo de recibo'],
  openGraph: {
    title: 'Gerador de Recibos de Pagamento — Angola',
    description: 'Recibos em PDF com valor, forma de pagamento e assinatura. Grátis e sem registo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function GeradorRecibosPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Gerador de Recibos</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Confirme pagamentos com um recibo em PDF apresentável: valor em destaque, forma de pagamento, data, referência e espaço para assinatura e carimbo. Sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <ReciboForm />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Valor em destaque</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">O valor recebido aparece numa caixa destacada, formatado em kwanzas — impossível de ignorar.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Forma de pagamento</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Numerário, transferência, Multicaixa ou cheque — registe como o dinheiro entrou.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Assinatura e carimbo</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">O PDF traz espaço reservado para assinatura, dando formalidade ao documento.</p></div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Boas práticas no recibo</h2>
      <ul>
        <li>Numere os recibos em sequência (REC-001, REC-002…) e guarde uma cópia de cada</li>
        <li>Indique sempre a que se refere o pagamento (nº da factura, mês de renda, etc.)</li>
        <li>Entregue o original a quem pagou e fique com a cópia assinada</li>
      </ul>
      <p>Um recibo comprova o pagamento, mas não substitui a factura fiscal: para vendas sujeitas a IVA, emita a factura com selo AGT — é exactamente o que o Machine Facturas faz automaticamente.</p>

      <h2 className="mt-10 text-2xl font-bold">Exemplo</h2>
      <p>Recibo REC-004, de 27/10/2026: recebido de Joana Mwangolé o valor de <strong>25.000 Kz</strong> por Multicaixa, referente ao pagamento da factura FT 2026/018. O PDF destaca o valor, identifica as partes e reserva o espaço de assinatura.</p>

      <RelatedTools actualId="recibos" categoria="Documentos Empresariais" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Recibos e facturas no mesmo sítio</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">No Machine Facturas, cada pagamento entra no recibo e actualiza a factura correspondente. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main>;
}
