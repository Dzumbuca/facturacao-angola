import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AdHtml } from '@/components/ad-html';
import { NifValidator } from './validator';

export const metadata: Metadata = {
  metadataBase: new URL('https://machinefaturas.shop'),
  title: 'Validador de NIF Angola — Verifica o formato do NIF | Machine Facturas',
  description: 'Validador de NIF angolano grátis: verifica o formato do NIF de empresas (10 dígitos) e particulares (9+2 letras+3). Instantâneo, sem registo.',
  keywords: ['validador NIF Angola', 'verificar NIF', 'NIF Angola formato', 'NIF AGT', 'validar NIF online'],
  openGraph: {
    title: 'Validador de NIF — Angola',
    description: 'Verifica o formato do NIF angolano. Grátis e instantâneo.',
    locale: 'pt_AO',
    type: 'website',
  },
};

export default async function ValidadorNifPage() {
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
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#2878d0]">Ferramenta grátis</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Validador de NIF — Angola</h1>
      <p className="mt-3 leading-7 text-[#4a5f76]">Verifica se um NIF angolano tem o formato correcto — de empresas e de particulares — antes de o usares numa factura.</p>

      <div className="mt-8 rounded-3xl border border-[#e2e9f1] bg-white p-6 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-8">
        <NifValidator />
      </div>

      <div className="mt-8 rounded-2xl border border-[#e2e9f1] bg-[#f7f9fc] p-5 text-sm leading-6 text-[#5b6f85]">
        <strong className="text-[#1c2d3f]">Nota:</strong> este validador confirma a <strong>estrutura</strong> do NIF, não a sua existência nem o nome do titular. A confirmação oficial junto da AGT é feita através dos serviços da Administração Geral Tributária.
      </div>

      <div className="mt-10 rounded-3xl bg-[#102b46] px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">Facturas com os NIFs sempre certos</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-blue-100/80">No Machine Facturas os NIFs dos clientes ficam guardados e entram automaticamente em cada factura. Grátis para começar — sem cartão.</p>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#38a7b8] px-8 text-base font-bold text-[#102b46] transition hover:bg-[#4fbccb]">Criar conta grátis</Link>
      </div>
    </article>

    <footer className="border-t border-[#e2e9f1] bg-white px-4 py-8 md:px-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 sm:flex-row">
        <span className="text-xs text-[#708195]">© 2026 Machine Facturas · Angola</span>
        <div className="flex gap-5 text-sm font-medium text-[#48627a]">
          <Link href="/ferramentas/iva" className="hover:text-[#2878d0]">Calculadora de IVA</Link>
          <Link href="/ferramentas/salario" className="hover:text-[#2878d0]">Salário líquido</Link>
          <Link href="/guias/emitir-facturas" className="hover:text-[#2878d0]">Guia de facturas</Link>
          <Link href="/inicio" className="hover:text-[#2878d0]">Início</Link>
        </div>
      </div>
    </footer>
  </main>;
}
