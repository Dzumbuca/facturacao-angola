import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { DespesasForm } from './despesas-form';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Gerador de Mapa de Despesas — Grátis | Machine Facturas',
  description: 'Organize grátis as despesas do seu negócio num mapa em PDF: data, categoria, descrição e valores em kwanzas, com totais por categoria. Sem registo.',
  keywords: ['mapa de despesas Angola', 'gerador de despesas PDF', 'controlo de despesas empresa', 'despesas kwanzas'],
  openGraph: {
    title: 'Gerador de Mapa de Despesas — Angola',
    description: 'Despesas organizadas em PDF, com totais por categoria. Grátis e sem registo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function GeradorDespesasPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Gerador de Mapa de Despesas</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Transforme uma lista solta de despesas num mapa organizado em PDF: data, categoria, descrição e valor, com total geral e resumo por categoria. Ideal para entregar ao contabilista — sem registo.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <DespesasForm />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Totais por categoria</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Transportes, serviços, rendas — o PDF agrupa e soma automaticamente por categoria.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Período definido</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Indique o período do mapa (mês, trimestre) e o documento fica identificado.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Nada fica guardado</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">O PDF é gerado na hora e os dados não ficam no servidor — privacidade total.</p></div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Como organizar as despesas</h2>
      <ul>
        <li>Use categorias consistentes (Transportes, Serviços, Rendas, Material…) — é por elas que o mapa soma</li>
        <li>Registe cada despesa com a data em que aconteceu, não a data em que a apontou</li>
        <li>Guarde os comprovativos (facturas, talões) correspondentes a cada linha</li>
      </ul>
      <p>O mapa resume o total geral e o total de cada categoria. Para a contabilidade formal e o IVA dedutível, as despesas precisam de factura com NIF — mais um motivo para facturar com o Machine Facturas.</p>

      <h2 className="mt-10 text-2xl font-bold">Exemplo</h2>
      <p>Outubro: gasóleo 15.000 Kz, internet 25.000 Kz e mais gasóleo 10.000 Kz:</p>
      <ul>
        <li>Transportes: 15.000 + 10.000 = <strong>25.000 Kz</strong></li>
        <li>Serviços: <strong>25.000 Kz</strong></li>
        <li>Total geral: <strong>50.000 Kz</strong></li>
      </ul>

      <RelatedTools actualId="mapa-despesas" categoria="Documentos Empresariais" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Despesas e rendimentos, sempre a par</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">No Machine Facturas, vê as suas facturas e recibes num só painel, com relatórios prontos para o IVA. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main>;
}
