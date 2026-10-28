import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ToolPage } from '@/components/tool-page';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';
import { BackToHub, RelatedTools } from '../tool-links';
import { SalaryCalculator } from './calculator';

// Anúncios actualizam a cada 60s sem novo deploy
export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Calculadora de Salário Líquido e IRT — Angola | Machine Facturas',
  description: 'Calculadora de salário líquido grátis para Angola: INSS (3%), IRT por escalões e salário que cai na conta. Tabela do IRT em vigor, resultados instantâneos.',
  keywords: ['calcular salario liquido Angola', 'calculadora IRT', 'IRT Angola 2026', 'INSS 3%', 'salario liquido Angola', 'tabela IRT'],
  openGraph: {
    title: 'Calculadora de Salário Líquido e IRT — Angola',
    description: 'INSS, IRT por escalões e salário líquido. Grátis e instantâneo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function CalculadoraSalarioPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Calculadora de Salário Líquido — Angola</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Descubra quanto cai na conta: desconta o INSS (3%), aplica o IRT por escalões e mostra o salário líquido. Resultados instantâneos.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <SalaryCalculator />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">INSS: 3%</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Contribuição do trabalhador para a segurança social, calculada sobre o salário bruto.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">IRT por escalões</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">Imposto sobre o rendimento do trabalho, com taxas de 0% a 22% segundo o rendimento tributável mensal.</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5"><h2 className="font-bold">Folha automática</h2><p className="mt-2 text-sm leading-6 text-[#5b6f85]">No Machine Facturas, os descontos e impostos são tratados automaticamente nos seus documentos.</p></div>
      </div>

      <div className="mt-8 rounded-2xl border border-[#e2e9f1] bg-[#f7f9fc] p-5 text-sm leading-6 text-[#5b6f85]">
        <strong className="text-[#1c2d3f]">Nota:</strong> cálculo indicativo com a tabela do IRT em vigor desde Janeiro de 2024 (rendimento do trabalho, descontando apenas o INSS do trabalhador). Deduções adicionais (dependentes, pensões, etc.) e casos especiais podem alterar o resultado — confirme sempre junto da AGT ou do seu contabilista.
      </div>

      <RelatedTools actualId="salario" categoria="Fiscalidade" />

      <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">A sua facturação, sem cálculos manuais</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">O Machine Facturas trata do IVA, IRT, assinatura digital e SAFT por si. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main></ToolPage>;
}
