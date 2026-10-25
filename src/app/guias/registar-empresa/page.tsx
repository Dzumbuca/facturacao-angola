import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AdHtml } from '@/components/ad-html';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Como registar uma empresa em Angola — guia 2026 | Machine Facturas',
  description: 'Passo a passo para registar a tua empresa em Angola: denominação, NIF na AGT, INSS, licenciamento e facturação em conformidade. Guia prático e gratuito.',
  keywords: ['como registar empresa Angola', 'abrir empresa Angola', 'NIF empresa Angola', 'INSS Angola', 'alvará Angola', 'registar Lda Angola'],
  openGraph: { title: 'Como registar uma empresa em Angola — guia 2026', description: 'Da denominação ao NIF e à primeira factura. Guia prático.', locale: 'pt_AO', type: 'article' },
};

export default async function GuiaRegistarEmpresaPage() {
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
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Como registar uma empresa em Angola</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Vais abrir um negócio? Este guia resume, por ordem, os passos típicos para formalizar uma empresa em Angola — da escolha do nome à primeira factura em conformidade. Os custos e prazos variam conforme o tipo de sociedade, por isso confirma sempre nos órgãos oficiais.</p>

      <h2>1. Escolhe o tipo de sociedade</h2>
      <p>Os formatos mais comuns são a <strong>empresa em nome individual</strong> (uma pessoa, mais simples) e a <strong>sociedade por quotas — Lda</strong> (dois ou mais sócios, responsabilidade limitada ao capital). A escolha afecta os documentos, os custos e a responsabilidade — um contabilista ou advogado pode ajudar a decidir.</p>

      <h2>2. Reserva de denominação e constituição</h2>
      <p>Verifica e reserva o nome da empresa e procede à constituição: para uma Lda, implica escritura ou acto de constituição (os estatutos) perante notário ou por documento particular reconhecido, conforme as opções em vigor nos serviços do registo comercial.</p>

      <h2>3. NIF na AGT</h2>
      <p>Com a empresa constituída, o passo seguinte é a <strong>identificação fiscal</strong> junto da AGT (Administração Geral Tributária), que atribui o NIF colectivo. Este número aparece em todas as tuas facturas e é indispensável para banca, segurança social e clientes empresariais. Podes verificar o formato com o nosso <Link href="/ferramentas/nif">validador de NIF</Link>.</p>

      <h2>4. Segurança social (INSS)</h2>
      <p>O registo da entidade empregadora no INSS é obrigatório quando tens trabalhadores — o empregador e o trabalhador contribuem com percentagens sobre o salário. Sem este registo, não podes processar salários em conformidade.</p>

      <h2>5. Licenciamento e alvará</h2>
      <p>Conforme a actividade, pode ser exigido licenciamento específico (comércio, serviços, produção...). O <strong>alvará comercial</strong> é o documento que autoriza a actividade — verifica na Conservatória do Registo Comercial ou nos serviços da tua província quais as exigências para o teu ramo.</p>

      <h2>6. Conta bancária empresarial</h2>
      <p>Com o NIF e o alvará, abre a conta bancária em nome da empresa. É ela que vai receber os pagamentos dos teus clientes — e é a partir dela que faz sentido gerir o negócio.</p>

      <h2>7. Facturação em conformidade</h2>
      <p>Desde o primeiro dia de vendas, as facturas devem cumprir os requisitos da AGT: os teus dados e os do cliente, numeração sequencial, IVA destacado (taxa geral de 14%) e assinatura digital do software. Para os cálculos, usa a nossa <Link href="/ferramentas/iva">calculadora de IVA</Link> — e o Machine Facturas trata da numeração, assinatura e SAFT automaticamente.</p>

      <div className="mt-8 rounded-2xl border border-[#e2e9f1] bg-[#f7f9fc] p-5 text-sm leading-6 text-[#5b6f85]">
        <strong className="text-[#1c2d3f]">Nota importante:</strong> este guia é indicativo e os requisitos, custos e prazos mudam com frequência. Confirma cada passo junto dos órgãos oficiais — Conservatória do Registo Comercial, AGT e INSS — ou com o teu contabilista.
      </div>

      <div className="mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Empresa registada? Factura em minutos.</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100/90">O Machine Facturas acompanha a tua empresa desde a primeira venda: facturas assinadas, SAFT-AO, relatórios e lembretes de cobrança. Grátis para começar.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#38a7b8] px-8 text-base font-bold text-[#102b46] transition hover:bg-[#4fbccb]">Criar conta grátis</Link>
      </div>
    </article>

    <SiteFooter />
  </main>;
}
