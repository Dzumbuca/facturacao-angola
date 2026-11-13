'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type SearchItem = { type: 'invoice' | 'customer' | 'product' | 'employee'; label: string; sub: string; href: string };

const ICONS: Record<SearchItem['type'], React.ReactNode> = {
  invoice: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
  customer: <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />,
  product: <path d="m12 2 9 5-9 5-9-5 9-5Z" />,
  employee: <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />,
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setItems([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data) => setItems(Array.isArray(data?.items) ? data.items : []))
        .catch(() => setItems([]));
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={wrapper} className="relative flex-1 max-w-md">
      <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-[#e1e8f0] bg-[#f5f7fb] px-3 text-sm text-[#5b6f85] transition focus-within:border-[#021f87] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#021f87]/10">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          type="search"
          aria-label="Pesquisar em toda a plataforma"
          placeholder="Pesquisar facturas, clientes, produtos…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-full w-full bg-transparent outline-none placeholder:text-[#93a4b8]"
        />
        {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => { setQuery(''); setItems([]); }} className="rounded-md p-1 text-[#8a99ab] hover:bg-[#eef2f6]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>}
      </label>
      {open && items.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-[#e1e8f0] bg-white shadow-[var(--shadow-card)]" role="listbox">
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((item) => (
              <li key={`${item.type}-${item.href}-${item.label}`}>
                <Link href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-[#1c2d3f] transition hover:bg-[#f5f8fc]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef4ff] text-[#021f87]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[item.type]}</svg>
                  </span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{item.label}</span><span className="block truncate text-[10px] text-[#8094a9]">{item.sub}</span></span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t border-[#eef2f6] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#aab8cc]">Resultados em tempo real</p>
        </div>
      )}
    </div>
  );
}
