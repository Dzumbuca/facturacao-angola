import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AdHtml } from '@/components/ad-html';

export const revalidate = 60;

const artigos: Record<string, { titulo: string; descricao: string; categoria: string; tempo: string; data: string }> = {
  'diferenca-entre-orcamento-factura-proforma-e-factura': {
    titulo: 'Diferença entre orçamento, factura proforma e factura em Angola',
    descricao: 'Quando usar orçamento, factura proforma ou factura em Angola? Diferenças práticas, valor fiscal e quando passar à factura definitiva.',
    categoria: 'Documentos',
    tempo: '6 min',
    data: '2026-11-02',
  },
  'erros-comuns-ao-emitir-facturas-em-angola': {
    titulo: 'Erros comuns ao emitir facturas em Angola (e como evitá-los)',
    descricao: 'Os deslizes mais frequentes na prática, com dicas simples para manter as facturas organizadas e menos propensas a correções.',
    categoria: 'Facturação',
    tempo: '7 min',
    data: '2026-11-02',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const artigo = artigos[slug];
  if (!artigo) return {};
  return {
    metadataBase: new URL('https://machinefaturas.shop'),
    title: `${artigo.titulo} | Academia Machine`,
    description: artigo.descricao,
    alternates: {
      canonical: `https://machinefaturas.shop/academia/${slug}`,
    },
    openGraph: {
      title: artigo.titulo,
      description: artigo.descricao,
      locale: 'pt_AO',
      type: 'article',
      url: `https://machinefaturas.shop/academia/${slug}`,
    },
  };
}

function ArtigoOrcamentoProforma() {
  return (
    <>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Documentos · 6 min de leitura</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Diferença entre orçamento, factura proforma e factura em Angola</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">
        Na prática angolana, estes três documentos servem propósitos diferentes. Saber qual usar evita confusões com o cliente e poupa tempo quando chega a altura de emitir a factura definitiva.
      </p>

      <div className="mt-6 rounded-2xl border border-[#e2e9f1] bg-[#f7f9fc] p-5 text-sm leading-6 text-[#5b6f85]">
        <strong className="text-[#1c2d3f]">Nota importante:</strong> este artigo tem caráter informativo e geral. Não substitui a consulta ao teu contabilista nem dispensa a verificação junto da AGT para o teu caso concreto.
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Visão rápida</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e2e9f1]">
        <table className="data-table min-w-[640px] bg-white">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Quando usar</th>
              <th>Valor fiscal</th>
              <th>Normalmente tem</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold">Orçamento</td>
              <td>Para apresentar preços e condições ao cliente, sem assumir compromisso de emissão automática.</td>
              <td>Geralmente sem valor fiscal</td>
              <td>Itens, preços, validade, condições</td>
            </tr>
            <tr>
              <td className="font-semibold">Factura Proforma</td>
              <td>Para formalizar uma cotação (importação/exportação, encomenda ou aprovação formal).</td>
              <td>Sem valor fiscal (não substitui factura)</td>
              <td>Itens, IVA destacado (quando aplicável), validade, nota de não-fiscal</td>
            </tr>
            <tr>
              <td className="font-semibold">Factura (definitiva)</td>
              <td>Quando o serviço/bem foi prestado/vendido e há registo da operação.</td>
              <td>Documento fiscal quando emitido nos termos aplicáveis</td>
              <td>Numeração, dados da empresa/cliente, elementos conforme sistema</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Quando escolher cada um</h2>
      <h3 className="mt-6 text-xl font-bold">1) Orçamento</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        Ideal quando ainda estás a negociar. É prático e claro. Muitas empresas definem um prazo de validade para evitar revisões constantes.
      </p>

      <h3 className="mt-6 text-xl font-bold">2) Factura Proforma</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        Útil quando o cliente precisa de algo mais formal. Apesar do aspeto, continua a ser pro forma — sem valor fiscal. Deve indicar que não substitui a factura definitiva.
      </p>

      <h3 className="mt-6 text-xl font-bold">3) Factura definitiva</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        É o documento para registar a operação. A forma concreta depende do tipo de negócio e das exigências aplicáveis — confirma com o teu contabilista em caso de dúvida.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Dicas práticas</h2>
      <ul className="mt-3 space-y-2 leading-7 text-[#4a5f76]">
        <li>• <strong>Seja claro</strong>: indica validade nos orçamentos e proformas.</li>
        <li>• <strong>Não confunda</strong>: proforma não é factura definitiva.</li>
        <li>• <strong>Passa à factura</strong>: quando há acordo e deve ser registada.</li>
        <li>• <strong>Organiza</strong>: guarda cópias para ter histórico.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Põe isto em prática</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/ferramentas/orcamento-pdf" className="rounded-xl border border-[#e2e9f1] bg-white p-4 transition hover:border-[#c9def2] hover:shadow-[0_6px_20px_rgba(25,52,80,.06)]">
          <p className="font-bold">Gerador de Orçamentos em PDF</p>
          <p className="mt-1 text-sm text-[#4a5f76]">Cria um orçamento profissional em segundos.</p>
        </Link>
        <Link href="/ferramentas/factura-proforma" className="rounded-xl border border-[#e2e9f1] bg-white p-4 transition hover:border-[#c9def2] hover:shadow-[0_6px_20px_rgba(25,52,80,.06)]">
          <p className="font-bold">Gerador de Factura Proforma</p>
          <p className="mt-1 text-sm text-[#4a5f76]">Ideal para cotações formais.</p>
        </Link>
      </div>
    </>
  );
}

function ArtigoErrosFacturas() {
  return (
    <>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Facturação · 7 min de leitura</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Erros comuns ao emitir facturas em Angola (e como evitá-los)</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">
        Pequenos deslizes podem gerar confusões ou retrabalho. Aqui ficam os erros mais frequentes na prática, com soluções simples para evitar correções desnecessárias.
      </p>

      <div className="mt-6 rounded-2xl border border-[#e2e9f1] bg-[#f7f9fc] p-5 text-sm leading-6 text-[#5b6f85]">
        <strong className="text-[#1c2d3f]">Nota importante:</strong> este artigo tem caráter informativo e geral. Não substitui a consulta ao teu contabilista nem dispensa a verificação junto da AGT para o teu caso concreto.
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Erros mais comuns e como evitá-los</h2>

      <h3 className="mt-6 text-xl font-bold">1) Usar o documento errado</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        <strong>Erro:</strong> Enviar uma proforma como se fosse factura definitiva, ou vice-versa.
        <br />
        <strong>Solução:</strong> Usa orçamento para negociar, proforma para proposta formal e factura definitiva quando for para registar a operação.
      </p>

      <h3 className="mt-6 text-xl font-bold">2) Dados incompletos do cliente</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        <strong>Erro:</strong> Falta do nome/NIF do cliente, especialmente em casos em que é necessário.
        <br />
        <strong>Solução:</strong> Cria uma ficha simples do cliente com os dados que usas com frequência. Guarda-a para não voltar a escrever tudo de cada vez.
      </p>

      <h3 className="mt-6 text-xl font-bold">3) Descrições vagas</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        <strong>Erro:</strong> Colocar "Serviço" ou "Mercadoria" sem detalhar.
        <br />
        <strong>Solução:</strong> Descreve de forma clara (ex.: "Prestação de serviço X", "Venda de Y unidades de Z"). Facilita a compreensão e o arquivo.
      </p>

      <h3 className="mt-6 text-xl font-bold">4) Cálculos manuais com erros</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        <strong>Erro:</strong> Calcular IVA à mão e somar errado, principalmente com várias linhas.
        <br />
        <strong>Solução:</strong> Usa uma calculadora ou sistema que some automaticamente por linha. Verifica sempre o total antes de enviar.
      </p>

      <h3 className="mt-6 text-xl font-bold">5) Falta de organização e numeração</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        <strong>Erro:</strong> Numeração desorganizada, facturas perdidas ou duplicadas.
        <br />
        <strong>Solução:</strong> Mantém uma sequência lógica. Guarda PDFs num ficheiro por ano/mês. Se usares um sistema, deixa que trate da numeração.
      </p>

      <h3 className="mt-6 text-xl font-bold">6) Não guardar comprovativos</h3>
      <p className="mt-2 leading-7 text-[#4a5f76]">
        <strong>Erro:</strong> Enviar sem guardar cópia ou sem registar o envio/pagamento.
        <br />
        <strong>Solução:</strong> Guarda sempre o PDF enviado e regista quando foi pago (data e forma). Isto poupa tempo em caso de dúvida.
      </p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Checklist antes de enviar</h2>
      <ul className="mt-3 space-y-2 leading-7 text-[#4a5f76]">
        <li>☐ <strong>Documento certo</strong> — orçamento/proforma/factura consoante a situação</li>
        <li>☐ <strong>Dados corretos</strong> — empresa e cliente bem identificados</li>
        <li>☐ <strong>Itens claros</strong> — quantidades, descrição e preços corretos</li>
        <li>☐ <strong>Totais verificados</strong> — soma e IVA conferidos</li>
        <li>☐ <strong>Numeração e data</strong> — presentes e corretos</li>
        <li>☐ <strong>Cópia guardada</strong> — PDF arquivado antes de enviar</li>
      </ul>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Ferramentas úteis</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link href="/ferramentas/iva" className="rounded-xl border border-[#e2e9f1] bg-white p-4 transition hover:border-[#c9def2] hover:shadow-[0_6px_20px_rgba(25,52,80,.06)]">
          <p className="font-bold">Calculadora de IVA</p>
          <p className="mt-1 text-sm text-[#4a5f76]">Acrescenta ou retira IVA com rapidez.</p>
        </Link>
        <Link href="/ferramentas/orcamento-pdf" className="rounded-xl border border-[#e2e9f1] bg-white p-4 transition hover:border-[#c9def2] hover:shadow-[0_6px_20px_rgba(25,52,80,.06)]">
          <p className="font-bold">Orçamento em PDF</p>
          <p className="mt-1 text-sm text-[#4a5f76]">Profissional, sem registo.</p>
        </Link>
        <Link href="/ferramentas/recibos" className="rounded-xl border border-[#e2e9f1] bg-white p-4 transition hover:border-[#c9def2] hover:shadow-[0_6px_20px_rgba(25,52,80,.06)]">
          <p className="font-bold">Gerador de Recibos</p>
          <p className="mt-1 text-sm text-[#4a5f76]">Comprova pagamentos facilmente.</p>
        </Link>
      </div>
    </>
  );
}

export default async function ArtigoAcademiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artigo = artigos[slug];
  if (!artigo) notFound();

  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch {
    adHtml = null;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: artigo.titulo,
    inLanguage: 'pt-AO',
    author: { '@type': 'Organization', name: 'Machine Facturas' },
    publisher: { '@type': 'Organization', name: 'Machine Facturas' },
    datePublished: artigo.data,
    dateModified: artigo.data,
    articleSection: artigo.categoria,
  };

  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />
      {adHtml && (
        <div className="mx-auto max-w-3xl px-4 pt-5 md:px-6">
          <div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2">
            <AdHtml html={adHtml} />
          </div>
        </div>
      )}

      <article className="prose-machine mx-auto max-w-3xl px-4 py-12 md:px-6">
        <nav className="mb-6 text-sm text-[#708195]">
          <Link href="/academia" className="hover:text-[#2878d0] hover:underline">Academia</Link>
          <span className="mx-2">/</span>
          <span className="text-[#1c2d3f]">{artigo.categoria}</span>
        </nav>
        {slug === 'diferenca-entre-orcamento-factura-proforma-e-factura' && <ArtigoOrcamentoProforma />}
        {slug === 'erros-comuns-ao-emitir-facturas-em-angola' && <ArtigoErrosFacturas />}

        <div className="prose-cta mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
          <h2 className="text-2xl font-bold md:text-3xl">Do conhecimento à facturação</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100">
            Quando chega a altura de emitir a factura definitiva, o Machine Facturas ajuda-te a fazê-lo de forma organizada.
          </p>
          <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd]">
            Criar conta grátis
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <Link href="/academia" className="text-sm font-semibold text-[#2878d0] hover:underline">← Voltar à Academia</Link>
          <Link href="/ferramentas" className="text-sm font-semibold text-[#2878d0] hover:underline">Ver ferramentas grátis →</Link>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
