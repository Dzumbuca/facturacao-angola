import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AdHtml } from '@/components/ad-html';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'SAFT-AO em Angola — guia passo a passo | Machine Facturas',
  description: 'O que é o ficheiro SAFT-AO, quem deve entregar, o que contém e como gerar o SAFT das tuas facturas em minutos. Guia prático para empresas angolanas.',
  keywords: ['SAFT Angola', 'SAFT-AO', 'ficheiro SAFT', 'AGT SAFT', 'como gerar SAFT', 'SAFT passo a passo'],
  openGraph: { title: 'SAFT-AO em Angola — guia passo a passo', description: 'O que é, quem entrega e como gerar o ficheiro SAFT. Grátis.', locale: 'pt_AO', type: 'article' },
};

export default async function GuiaSaftPage() {
  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch { adHtml = null; }

  return <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    <SiteHeader />

    {adHtml && <div className="mx-auto max-w-3xl px-4 pt-5 md:px-6"><div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2"><AdHtml html={adHtml} /></div></div>}

    <article className="prose-machine mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Guia prático · 2026</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">SAFT-AO em Angola: guia passo a passo</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Se já ouviste o contabilista pedir "o ficheiro SAFT", este guia explica o que é, quem deve entregá-lo e como gerá-lo em minutos — sem programas instalados no computador.</p>

      <h2>O que é o SAFT-AO?</h2>
      <p>SAFT significa <strong>Standard Audit File for Tax purposes</strong> — é um ficheiro electrónico, em XML, que concentra toda a informação fiscal de uma empresa num período: facturas emitidas, clientes, produtos e movimentos contabilísticos. A versão angolana (SAFT-AO) segue as especificações da Administração Geral Tributária (AGT) e é o formato que a AGT usa em auditorias e nas prestações de contas.</p>

      <h2>Quem deve entregar?</h2>
      <p>De forma geral, as empresas sujeitas a IVA em regime regular devem manter e poder entregar o SAFT-AO, com periodicidade conforme o seu regime fiscal. Empresas em regimes simplificados ou com situações especiais podem ter regras diferentes — <strong>confirma sempre o teu caso junto da AGT ou do teu contabilista</strong>.</p>

      <h2>O que contém o ficheiro?</h2>
      <ul>
        <li><strong>Cabeçalho da empresa</strong> — denominação, NIF, ano e período do ficheiro;</li>
        <li><strong>Tabela de clientes</strong> — os adquirentes das tuas facturas com os seus NIF;</li>
        <li><strong>Tabela de produtos e serviços</strong> — o teu catálogo;</li>
        <li><strong>Documentos comerciais</strong> — todas as facturas do período, com datas, números, valores, IVA e os códigos de controlo derivados da assinatura digital;</li>
        <li><strong>Contabilidade</strong> — os movimentos contabilísticos do período, quando aplicável.</li>
      </ul>

      <h2>Como gerar o SAFT no Machine Facturas (passo a passo)</h2>
      <ol>
        <li><strong>Mantém os dados da empresa completos</strong> — nome, NIF e sede entram no cabeçalho do ficheiro;</li>
        <li><strong>Regista todas as facturas no sistema</strong> — incluindo clientes com NIF, para a tabela de adquirentes ficar completa;</li>
        <li><strong>Abre Relatórios → Exportação SAFT-AO</strong>, escolhe o mês e o ano, e clica em <em>Descarregar SAFT-AO</em>;</li>
        <li><strong>Guarda o ficheiro XML</strong> e envia-o ao teu contabilista ou submete-o onde a AGT indicar.</li>
      </ol>

      <h2>Erros comuns a evitar</h2>
      <ul>
        <li>Falta do NIF do cliente na factura — a tabela de adquirentes fica incompleta;</li>
        <li>Facturas emitidas fora do sistema — não entram no ficheiro e criam quebras de sequência;</li>
        <li>Dados da empresa incompletos no perfil — o cabeçalho do SAFT fica sem informação obrigatória.</li>
      </ul>

      <h2>Perguntas frequentes</h2>
      <details><summary>O SAFT substitui as facturas?</summary><p>Não. O SAFT é um ficheiro de comunicação/auditoria — as facturas continuam a existir como documentos individuais, assinados digitalmente.</p></details>
      <details><summary>Preciso de um programa instalado?</summary><p>Não. O Machine Facturas gera o SAFT-AO online, a partir de qualquer dispositivo, no plano Pro.</p></details>
      <details><summary>Com que frequência se gera?</summary><p>Conforme o teu regime e as instruções da AGT — muitos contabilistas pedem o ficheiro mensal para conciliação.</p></details>
    </article>

    <section className="mx-auto -mt-4 mb-12 max-w-3xl px-4 md:px-6">
      <div className="rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">O teu SAFT, com um clique</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100/90">O Machine Facturas gera o ficheiro SAFT-AO do mês que escolheres — além das facturas assinadas digitalmente. Grátis para começar.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#38a7b8] px-8 text-base font-bold text-[#102b46] transition hover:bg-[#4fbccb]">Criar conta grátis</Link>
      </div>
    </section>

    <SiteFooter />
  </main>;
}
