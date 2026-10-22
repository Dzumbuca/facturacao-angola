import Link from 'next/link';

export function AdminPagination({ page, pageCount, searchParams }: { page: number; pageCount: number; searchParams: Record<string, string | string[] | undefined> }) {
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) if (typeof value === 'string' && key !== 'page') params.set(key, value);
    params.set('page', String(target));
    return `?${params.toString()}`;
  };
  return <nav aria-label="Paginação" className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
    <span className="text-slate-600">Página {page} de {Math.max(pageCount, 1)}</span>
    <div className="flex gap-2">
      {page > 1 ? <Link className="rounded border px-3 py-2 hover:bg-slate-50" href={href(page - 1)}>Anterior</Link> : <span className="rounded border px-3 py-2 text-slate-400">Anterior</span>}
      {page < pageCount ? <Link className="rounded border px-3 py-2 hover:bg-slate-50" href={href(page + 1)}>Seguinte</Link> : <span className="rounded border px-3 py-2 text-slate-400">Seguinte</span>}
    </div>
  </nav>;
}
