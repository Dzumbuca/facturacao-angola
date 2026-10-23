import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AdHtml } from '@/components/ad-html';

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Como emitir facturas em Angola (guia 2026) | Machine Facturas',
  description: 'Guia prático: o que uma factura precisa em Angola, IVA de 14%, certificação AGT, SAFT e como emitir facturas certificadas online em minutos.',
  keywords: ['como emitir facturas Angola', 'facturação Angola', 'AGT', 'SAFT', 'IVA facturas', 'factura certificada'],
  openGraph: { title: 'Como emitir facturas em Angola — guia prático', description: 'Tudo o que uma factura precisa em Angola: IVA, AGT, SAFT e assinatura digital.', locale: 'pt_AO', type: 'article' },
};

export default async function GuiaEmitirFacturasPage() {
  let adHtml: string | null = null;
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } });
    adHtml = config?.adHtml ?? null;
  } catch { adHtml = null; }

  return <main className="min-h-screen bg-[#f3f6fa] text-[#1c2d3f]">
    <header className="border-b border-[#e2e9f1] bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/inicio" className="flex items-center gap-2">
          <img src="/logo.png" alt="Facturas" className="h-9 w-auto rounded-lg bg-white object-contain px-1.5 py-1" />
          <span className="text-sm font-extrabold tracking-[.08em] text-[#102b46]">MACHINE FACTURAS</span>
        </Link>
        <Link href="/register" className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#216bbd]">Criar conta grátis</Link>
      </div>
    </header>

    {adHtml && <div className="mx-auto max-w-4xl px-4 pt-5 md:px-6"><div className="overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2"><AdHtml html={adHtml} /></div></div>}

    <article className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Guia prático · 2026</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Como emitir facturas em Angola</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Se tens uma empresa em Angola, emitir facturas em conformidade fiscal não é opcional — e desde a introdução do IVA e das exigências da AGT, o processo tem regras claras. Este guia resume o essencial para emitir facturas correctas, em minutos.</p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">1. O que toda a factura deve conter</h2>
      <p className="mt-3 leading-7 text-[#4a5f76]">Em Angola, os documentos de venda devem identificar, no mínimo:</p>
      <ul className="mt-3 space-y-2 leading-7 text-[#4a5f76]">
        <li>• <strong>Os teus dados</strong>: nome/denominação da empresa, NIF, sede e contactos;</li>
        <li>• <strong>Os dados do cliente</strong>: nome e NIF do adquirente (obrigatório em facturas acima de certos montantes e sempre para empresas);</li>
        <li>• <strong>Numeração sequencial</strong> e data de emissão;</li>
        <li>• <strong>Descrição dos bens/serviços</strong>, quantidades, preço unitário;</li>
        <li>• <strong>O IVA destacado</strong> (taxa geral de 14% em Angola, com taxas reduzidas para bens essenciais);</li>
        <li>• <strong>O total a pagar</strong> em Kwanzas (AOA);</li>
        <li>• <strong>Elementos fiscais exigidos pela AGT</strong>, como o código de controlo derivado da assinatura do documento.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">2. IVA: 14% e as taxas reduzidas</h2>
      <p className="mt-3 leading-7 text-[#4a5f76]">O Imposto sobre o Valor Acrescentado substituiu o antigo imposto de consumo e aplica a taxa geral de <strong>14%</strong>. Existem taxas reduzidas (7% e 2%) para bens e serviços essenciais, e operações isentas. Se preferires automatizar, usa a nossa <Link href="/ferramentas/iva" className="font-semibold text-[#2878d0] hover:underline">calculadora de IVA grátis</Link> para ver o imposto destacado em qualquer valor.</p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">3. Assinatura digital e certificação AGT</h2>
      <p className="mt-3 leading-7 text-[#4a5f76]">A AGT exige que o software de facturação produza documentos com <strong>integridade garantida</strong>: cada factura leva um código de controlo derivado de uma <strong>assinatura digital RSA</strong> sobre o conteúdo do documento, encadeado com a factura anterior. Software não certificado pode originar coimas e a recusa dos documentos em auditoria. Antes de escolher um sistema, confirma o estado da <strong>certificação de software facturativo</strong> junto da AGT.</p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">4. SAFT-AO: o ficheiro que a AGT pede</h2>
      <p className="mt-3 leading-7 text-[#4a5f76]">Para além das facturas, as empresas devem poder exportar o <strong>ficheiro SAFT-AO</strong> (Standard Audit File for Tax purposes — versão Angola) com todas as facturas e contas do período. É o formato que a AGT usa em auditorias e communication de contas. Um bom sistema de facturação gera-o automaticamente.</p>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">5. Como emitir em minutos (online)</h2>
      <p className="mt-3 leading-7 text-[#4a5f76]">Com um sistema online certificado, o processo resume-se a:</p>
      <ol className="mt-3 space-y-2 leading-7 text-[#4a5f76]">
        <li>1. Criar a conta da empresa (1 minuto, com Google);</li>
        <li>2. Registar clientes e produtos/serviços;</li>
        <li>3. Preencher a factura — o IVA, a numeração, a assinatura e o PDF são gerados automaticamente;</li>
        <li>4. Exportar o SAFT quando a AGT pedir.</li>
      </ol>
      <div className="mt-6 rounded-2xl bg-[#102b46] p-6 text-center text-white">
        <p className="text-lg font-bold">Experimenta grátis — sem cartão</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-blue-100/80">O Machine Facturas trata do IVA, da assinatura digital, da numeração e do SAFT por ti. Começa no plano Grátis.</p>
        <Link href="/register" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#38a7b8] px-7 text-sm font-bold text-[#102b46] transition hover:bg-[#4fbccb]">Criar conta grátis</Link>
      </div>

      <h2 className="mt-10 text-2xl font-bold tracking-tight">Perguntas frequentes</h2>
      <div className="mt-4 space-y-5">
        <div><h3 className="font-bold">Preciso de NIF para emitir factura?</h3><p className="mt-1 leading-7 text-[#4a5f76]">Para clientes empresas, sim — o NIF do adquirente é obrigatório. Para consumidores finais, a factura pode ser emitida sem NIF, mas o documento continua a precisar de todos os elementos fiscais.</p></div>
        <div><h3 className="font-bold">Posso emitir facturas pelo telemóvel?</h3><p className="mt-1 leading-7 text-[#4a5f76]">Sim. Sistemas online como o Machine Facturas funcionam no navegador do telemóvel — emissão, PDF e pagamentos em qualquer lugar.</p></div>
        <div><h3 className="font-bold">Quanto custa o IVA em Angola?</h3><p className="mt-1 leading-7 text-[#4a5f76]">A taxa geral é de 14%. Existem taxas reduzidas de 7% e 2% para bens essenciais, e operações isentas listadas na lei. Usa a <Link href="/ferramentas/iva" className="font-semibold text-[#2878d0] hover:underline">calculadora de IVA</Link> para valores rápidos.</p></div>
      </div>
    </article>

    <footer className="border-t border-[#e2e9f1] bg-white px-4 py-8 md:px-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 sm:flex-row">
        <span className="text-xs text-[#708195]">© 2026 Machine Facturas · Angola</span>
        <div className="flex gap-5 text-sm font-medium text-[#48627a]">
          <Link href="/ferramentas/iva" className="hover:text-[#2878d0]">Calculadora de IVA</Link>
          <Link href="/ferramentas/salario" className="hover:text-[#2878d0]">Salário líquido</Link>
          <Link href="/inicio" className="hover:text-[#2878d0]">Início</Link>
        </div>
      </div>
    </footer>
  </main>;
}
