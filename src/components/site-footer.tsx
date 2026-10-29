import Link from 'next/link';
import Script from 'next/script';
import { auth } from '@/lib/auth';
import { ADSENSE_CLIENT_ID } from '@/lib/adsense';
import { AdSenseSlot } from '@/components/adsense-slot';

// Rodapé partilhado de todas as páginas públicas — coerente entre páginas.
// Consciente da sessão (NextAuth), tal como o SiteHeader: um visitante vê
// «Criar conta grátis» e «Entrar»; um cliente autenticado passa a ver o acesso
// à sua área — as duas opções de autenticação não se mostram a quem já entrou.
export async function SiteFooter() {
  const session = await auth();
  const authenticated = Boolean(session?.user?.id);

  return <>
    {/* Google AdSense — apenas para visitantes: o loader nunca corre na
        experiência autenticada (nas ferramentas o rodapé é escondido por CSS,
        mas antes o script continuava a ser transferido). next/script com id
        fixo evita scripts duplicados e carrega sem bloquear a página. */}
    {!authenticated && <>
      <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
      <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
      <Script
        id="adsense-loader"
        strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
        crossOrigin="anonymous"
      />
    </>}
    {/* Espaço publicitário acima do rodapé (todas as páginas públicas com
        rodapé). Só é renderizado com um ID de bloco oficial em
        NEXT_PUBLIC_ADSENSE_SLOT_INPAGE; para clientes autenticados nunca
        aparece. */}
    {!authenticated && <AdSenseSlot placement="inpage-footer" authenticated={false} wrapperClassName="border-t border-[#e2e9f1] bg-white" minHeight={110} />}
    <footer className="border-t border-[#e2e9f1] bg-[#0b1d33] px-4 py-12 text-slate-300 md:px-6">
    <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div>
        <div className="flex items-center gap-2">
          <img src="/logo.png" width="800" height="600" alt="Machine Facturas" className="h-9 w-auto rounded-lg bg-white object-contain px-1.5 py-1" />
          <span className="text-sm font-extrabold tracking-[.08em] text-white">MACHINE FACTURAS</span>
        </div>
        <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">Facturação online para empresas angolanas — assinatura digital padrão AGT, SAFT-AO e relatórios, do telemóvel ou computador.</p>
      </div>
      <nav aria-label="Produto">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">Produto</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link href="/inicio#funcionalidades" className="text-slate-300 transition hover:text-white">Funcionalidades</Link></li>
          <li><Link href="/inicio#precos" className="text-slate-300 transition hover:text-white">Preços</Link></li>
          {authenticated ? (
            <li><Link href="/" className="text-slate-300 transition hover:text-white">Minha área</Link></li>
          ) : (
            <>
              <li><Link href="/register" className="text-slate-300 transition hover:text-white">Criar conta grátis</Link></li>
              <li><Link href="/login" className="text-slate-300 transition hover:text-white">Entrar</Link></li>
            </>
          )}
        </ul>
      </nav>
      <nav aria-label="Ferramentas grátis">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">Ferramentas grátis</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link href="/ferramentas" className="text-slate-300 transition hover:text-white">Centro de Ferramentas</Link></li>
          <li><Link href="/ferramentas/iva" className="text-slate-300 transition hover:text-white">Calculadora de IVA</Link></li>
          <li><Link href="/ferramentas/conversor-iva" className="text-slate-300 transition hover:text-white">Conversor de IVA</Link></li>
          <li><Link href="/ferramentas/lucro" className="text-slate-300 transition hover:text-white">Lucro e margem</Link></li>
          <li><Link href="/ferramentas/preco-venda" className="text-slate-300 transition hover:text-white">Preço de venda</Link></li>
          <li><Link href="/ferramentas/salario" className="text-slate-300 transition hover:text-white">Salário líquido e IRT</Link></li>
          <li><Link href="/ferramentas/nif" className="text-slate-300 transition hover:text-white">Validador de NIF</Link></li>
        </ul>
      </nav>
      <nav aria-label="Recursos e empresa">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">Recursos</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link href="/guias/emitir-facturas" className="text-slate-300 transition hover:text-white">Como emitir facturas</Link></li>
          <li><Link href="/privacidade" className="text-slate-300 transition hover:text-white">Privacidade</Link></li>
          <li><Link href="/termos" className="text-slate-300 transition hover:text-white">Termos</Link></li>
          <li><a href="mailto:machinefacturas@gmail.com" className="text-slate-300 transition hover:text-white">Contacto</a></li>
        </ul>
      </nav>
    </div>
    <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
      <p className="text-xs text-slate-500">© 2026 Machine Facturas · Angola</p>
      <a href="https://beta.publishers.adsterra.com/referral/L8Y8skqCEG" rel="nofollow" className="text-xs text-slate-500 transition hover:text-slate-300">Programa de afiliados</a>
    </div>
    </footer>
  </>;
}
