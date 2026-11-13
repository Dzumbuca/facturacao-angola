'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { NavIcon } from '@/components/nav-icons';

type AppItem = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  isCore?: boolean;
};

const APP_META: Record<string, { category: 'Financeiro' | 'Operações' | 'Gestão'; tagline: string; href: string; features: string[]; accent: string }> = {
  'machine-facturas': {
    category: 'Financeiro',
    tagline: 'Facturação e gestão empresarial',
    href: '/',
    features: ['Facturação', 'Clientes', 'Recebimentos', 'Relatórios'],
    accent: '#021f87',
  },
  wms: {
    category: 'Operações',
    tagline: 'Armazéns, transferências, lotes, reservas e compras',
    href: '/warehouses',
    features: ['Multi-armazém', 'Transferências', 'Lotes', 'Compras'],
    accent: '#248468',
  },
  rh: {
    category: 'Gestão',
    tagline: 'Funcionários, assiduidade, contratos e processamento salarial',
    href: '/rh/dashboard',
    features: ['Assiduidade', 'Contratos', 'Documentos', 'Processamento'],
    accent: '#5b34d6',
  },
};

function StatusBadge({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cbe8dc] bg-[#eff9f4] px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#227958] dark:border-[#1f3a2a] dark:bg-[#0e241b] dark:text-[#34d399]">
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
        Activa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]">
      Não activada
    </span>
  );
}

export function AppsClient({ initialApps }: { initialApps: AppItem[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'Todas' | 'Financeiro' | 'Operações' | 'Gestão'>('Todas');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const apps = useMemo(() => [
    ...initialApps.map((a) => ({ ...a, ...(APP_META[a.slug] ?? { category: 'Gestão' as const, tagline: a.description ?? '', href: `/${a.slug}`, features: [], accent: '#021f87' }) })),
  ], [initialApps]);

  const merged = useMemo(() => {
    const bySlug = new Map<string, typeof apps[number]>();
    for (const a of apps) bySlug.set(a.slug, a);
    return Array.from(bySlug.values());
  }, [apps]);

  const total = merged.length;
  const activeCount = merged.filter((a) => a.enabled).length;
  const inactiveCount = total - activeCount;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Todas: merged.length };
    for (const a of merged) {
      const c = (a as any).category ?? 'Gestão';
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [merged]);
  const categories = useMemo(() => ['Todas', ...Object.keys(categoryCounts).filter(k => k !== 'Todas')] as const, [categoryCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((a) => {
      const matchesCategory = category === 'Todas' || (a as any).category === category;
      const matchesQuery = !q || [a.name, a.description, (a as any).tagline, ...((a as any).features ?? [])].join(' ').toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [merged, query, category]);


  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <section aria-label="Resumo das aplicações" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Disponíveis</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[var(--text)] sm:text-3xl">{total}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">módulos integrados</p>
        </div>
        <div className="rounded-[16px] border border-[#cbe8dc] bg-[#eff9f4] p-4 shadow-[var(--shadow-card)] dark:border-[#1f3a2a] dark:bg-[#0e241b]">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#227958] dark:text-[#34d399]">Activas</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#267256] dark:text-[#34d399] sm:text-3xl">{activeCount}</p>
          <p className="mt-0.5 text-[11px] text-[#1e5e38] dark:text-[#7bd9a6]">em funcionamento</p>
        </div>
        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Para activar</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[var(--text)] sm:text-3xl">{inactiveCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">ainda sem acesso</p>
        </div>
      </section>

      {/* Search + Category chips */}
      <section aria-label="Filtros" className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text)]">Pesquisar</span>
          <div className="relative mt-1.5">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por nome, número ou descrição..." autoComplete="off" spellCheck={false} className="app-input pl-11 pr-20" style={{ paddingLeft: '2.75rem', paddingRight: '5rem' }} aria-label="Pesquisar aplicações" />
            {query ? (
              <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} type="button" aria-label="Limpar pesquisa" className="absolute right-10 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
            ) : (
              <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--text-muted)] sm:flex">
                <kbd>Ctrl</kbd><kbd>K</kbd>
              </span>
            )}
          </div>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Categoria"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <button key={cat} role="tab" aria-selected={active} onClick={() => setCategory(cat as typeof category)} className={`min-h-9 inline-flex items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition ${active ? 'border-transparent bg-[var(--blue)] text-white shadow-[0_6px_14px_rgba(2,31,135,.28)]' : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text)] hover:border-[var(--blue)] hover:text-[var(--blue)]'}`}>
                {cat}
                <span className={`tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)]'}`}>{categoryCounts[cat] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* App cards grid */}
      <section aria-label="Aplicações disponíveis" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {filtered.length ? filtered.map((app: any) => (
          <article key={app.slug} className="group flex h-full flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-[2px] hover:border-[var(--blue)]">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] ring-1" style={{ background: `${app.accent}14`, color: app.accent, borderColor: `${app.accent}33` }}>
                <NavIcon name={app.icon} className="h-6 w-6" />
              </div>
              <StatusBadge enabled={app.enabled} />
            </div>
            <h3 className="mt-3 text-[18px] font-extrabold tracking-tight text-[var(--text)]">{app.name}</h3>
            <p className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">{app.tagline || app.description}</p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--text-muted)]">{app.category}</p>
            {app.features?.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {app.features.slice(0, 4).map((f: string) => (
                  <li key={f} className="rounded-md bg-[var(--surface-raised)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">{f}</li>
                ))}
                {app.features.length > 4 && (
                  <li className="rounded-md bg-[var(--surface-raised)] px-2 py-1 text-[10px] font-semibold text-[var(--blue)]">+{app.features.length - 4}</li>
                )}
              </ul>
            )}
            <div className="mt-auto pt-4">
              {app.enabled ? (
                <Link href={app.href} className="inline-flex min-h-11 w-full items-center justify-center rounded-[12px] bg-[var(--blue)] px-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0634b8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]">Abrir aplicação →</Link>
              ) : (
                <Link href="/pagamento" className="inline-flex min-h-11 w-full items-center justify-center rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] px-4 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]">Contratar aplicação →</Link>
              )}
            </div>
          </article>
        )) : (
          <div className="col-span-full rounded-[16px] border border-dashed border-[var(--line)] bg-[var(--surface-raised)] p-8 text-center">
            <p className="text-sm font-bold text-[var(--text)]">Nenhuma aplicação encontrada.</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Experimenta outra palavra ou limpa os filtros.</p>
            <button type="button" onClick={() => { setQuery(''); setCategory('Todas'); }} className="mt-3 inline-flex min-h-9 items-center rounded-[10px] bg-[var(--blue)] px-4 text-xs font-semibold text-white">Limpar pesquisa e filtros</button>
          </div>
        )}
      </section>
    </div>
  );
}
