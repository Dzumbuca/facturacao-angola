'use client';

import { useEffect, useRef, useState } from 'react';
import { NavIcon } from '@/components/nav-icons';

type ProductResult = {
  id: string;
  codigo: string | null;
  name: string;
  barcode: string | null;
  categoria: string;
  marca: string | null;
  modelo: string | null;
  unidade: string;
  price: number;
  stock: number;
  availableInWarehouse: number | null;
};

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(value || 0);
}

export function ProductPicker({
  value,
  onChange,
  warehouseId,
  id = 'product-picker',
  placeholder = 'Pesquisar por nome, SKU ou código de barras',
  invalid = false,
  errorId,
}: {
  value: string;
  onChange: (product: { id: string; name: string; codigo: string | null; barcode: string | null; unidade: string; availableInWarehouse: number | null }) => void;
  warehouseId?: string;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  errorId?: string;
}) {
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [empty, setEmpty] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) setLabel('');
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query, limit: '20' });
      if (warehouseId) params.set('warehouseId', warehouseId);
      fetch(`/api/produtos/search?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) { setResults([]); setEmpty(true); return; }
          setResults(data.items ?? []);
          setEmpty((data.items ?? []).length === 0);
        })
        .catch(() => { if (!controller.signal.aborted) setResults([]); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, open, warehouseId]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function select(item: ProductResult) {
    setLabel(`${item.name} · ${item.codigo ?? item.barcode ?? '—'}`);
    setQuery('');
    setOpen(false);
    onChange({ id: item.id, name: item.name, codigo: item.codigo, barcode: item.barcode, unidade: item.unidade, availableInWarehouse: item.availableInWarehouse });
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-invalid={invalid}
          aria-describedby={errorId}
          autoComplete="off"
          className={`app-input pl-10 ${invalid ? 'border-[#d98a8a]' : ''}`}
          placeholder={placeholder}
          value={open ? query : label}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) { onChange({ id: '', name: '', codigo: null, barcode: null, unidade: 'un', availableInWarehouse: null }); } }}
        />
        <NavIcon name="box" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#607286]" />
        {label && !open && (
          <button type="button" aria-label="Limpar produto" onClick={() => { setLabel(''); setQuery(''); onChange({ id: '', name: '', codigo: null, barcode: null, unidade: 'un', availableInWarehouse: null }); inputRef.current?.focus(); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#708195] hover:bg-[#f2f6fb]">×</button>
        )}
      </div>

      {open && (
        <div id={`${id}-listbox`} role="listbox" className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-[#e1e8f0] bg-white shadow-[var(--shadow-card)]">
          {loading && <p className="px-4 py-3 text-sm text-[#708195]">A pesquisar…</p>}
          {!loading && empty && <p className="px-4 py-3 text-sm text-[#708195]">Nenhum produto encontrado.</p>}
          {!loading && results.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              onClick={() => select(item)}
              className="flex w-full items-center gap-3 border-b border-[#edf1f5] px-4 py-2.5 text-left transition last:border-0 hover:bg-[#f7faff]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#1c2d3f]">{item.name}</span>
                <span className="block truncate text-xs text-[#708195]">
                  {[item.codigo, item.barcode, item.marca, item.categoria].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs font-medium tabular-nums text-[#263c52]">{warehouseId ? (item.availableInWarehouse ?? 0) : item.stock} {item.unidade || 'un'}</span>
                <span className="block text-xs text-[#708195]">{money(item.price)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
