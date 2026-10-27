import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { FERRAMENTAS } from './tools-data';

// Navegação partilhada pelas páginas de ferramentas: regresso ao centro e
// ligações para ferramentas relacionadas (mesma categoria, já publicadas).
export function BackToHub() {
  return <div className="mb-4 flex items-center justify-between gap-3">
    <Link href="/ferramentas" className="prose-nav inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#48627a] transition hover:text-[#2878d0]">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      Centro de Ferramentas
    </Link>
    <ThemeToggle compact />
  </div>;
}

export function RelatedTools({ actualId, categoria, titulo = 'Ferramentas relacionadas' }: { actualId: string; categoria: string; titulo?: string }) {
  const relacionadas = FERRAMENTAS.filter((f) => f.categoria === categoria && f.id !== actualId && f.estado === 'ativa').slice(0, 3);
  if (relacionadas.length === 0) return null;
  return <nav aria-label={titulo} className="prose-links mt-10 rounded-2xl border border-[#e2e9f1] bg-white p-5">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#708195]">{titulo}</p>
    <ul className="mt-3 flex flex-wrap gap-2">
      {relacionadas.map((ferramenta) => (
        <li key={ferramenta.id}>
          <Link href={ferramenta.href ?? '/ferramentas'} className="prose-chip inline-flex min-h-10 items-center rounded-lg border border-[#c9def2] bg-white px-4 text-sm font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]">
            {ferramenta.nome}
          </Link>
        </li>
      ))}
      <li>
        <Link href="/ferramentas" className="prose-chip inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold text-[#48627a] transition hover:bg-[#f0f6fc]">
          Ver todas →
        </Link>
      </li>
    </ul>
  </nav>;
}
