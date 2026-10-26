import Link from 'next/link';

// Rodapé partilhado de todas as páginas públicas — coerência entre páginas.
export function SiteFooter() {
  return <footer className="border-t border-[#e2e9f1] bg-[#0b1d33] px-4 py-12 text-slate-300 md:px-6">
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
          <li><Link href="/register" className="text-slate-300 transition hover:text-white">Criar conta grátis</Link></li>
          <li><Link href="/login" className="text-slate-300 transition hover:text-white">Entrar</Link></li>
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
    {/* Google AdSense — carregado APENAS nas páginas públicas (com anúncios),
        nunca no login/registar/dashboard. A verificação do AdSense continua
        a encontrar o código porque estas páginas são as apresentadas na conta. */}
    <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
    <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9283668518139905" crossOrigin="anonymous" />
  </footer>;
}
