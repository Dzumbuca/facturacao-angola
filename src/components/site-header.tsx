import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

// Cabeçalho partilhado de todas as páginas públicas — coerência entre páginas.
export function SiteHeader() {
  return <header className="site-header sticky top-0 z-40 border-b border-[#e2e9f1] bg-white/95 backdrop-blur">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
      <Link href="/inicio" className="flex items-center gap-2">
        <img src="/logo.png" width="800" height="600" alt="Machine Facturas" className="h-9 w-auto rounded-lg bg-white object-contain px-1.5 py-1" />
        <span className="text-sm font-extrabold tracking-[.08em] text-[#102b46]">MACHINE FACTURAS</span>
      </Link>
      <nav aria-label="Navegação principal" className="flex items-center gap-1 sm:gap-2">
        <Link href="/inicio#funcionalidades" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#48627a] transition hover:bg-[#f0f6fc] hover:text-[#2878d0] md:inline">Funcionalidades</Link>
        <Link href="/ferramentas" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#48627a] transition hover:bg-[#f0f6fc] hover:text-[#2878d0] md:inline">Ferramentas</Link>
        <Link href="/guias/emitir-facturas" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#48627a] transition hover:bg-[#f0f6fc] hover:text-[#2878d0] md:inline">Guia</Link>
        <Link href="/inicio#precos" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#48627a] transition hover:bg-[#f0f6fc] hover:text-[#2878d0] md:inline">Preços</Link>
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]">Entrar</Link>
        <ThemeToggle compact />
        <Link href="/register" className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#216bbd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">Criar conta grátis</Link>
      </nav>
    </div>
  </header>;
}
