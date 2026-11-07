'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Product = {
  id: string;
  name: string;
  codigo: string | null;
  price: number | string;
  stock: number;
  minStock: number;
  categoria: string;
};

type Props = {
  products: Product[];
  searchQuery?: string;
  categoryFilter?: string;
  availabilityFilter?: string;
  onSearchChange?: (value: string) => void;
  onCategoryChange?: (value: string) => void;
  onAvailabilityChange?: (value: string) => void;
};

function getStockStatus(stock: number, minStock: number) {
  if (stock <= 0) return { label: 'Sem stock', className: 'bg-[#fdf3f3] text-[#a83939] border border-red-100' };
  if (stock <= minStock) return { label: 'Stock baixo', className: 'bg-[#fdf6e9] text-[#8a5a10] border border-amber-100' };
  return { label: 'OK', className: 'bg-[#eff9f4] text-[#267256] border border-[#cbe8dc]' };
}

export function ProductStockGrid({
  products,
  searchQuery = '',
  categoryFilter = '',
  availabilityFilter = '',
  onSearchChange,
  onCategoryChange,
  onAvailabilityChange,
}: Props) {
  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q));
    const matchCategory = categoryFilter ? p.categoria === categoryFilter : true;
    let matchAvailability = true;
    if (availabilityFilter === 'stock') matchAvailability = p.stock > 0;
    if (availabilityFilter === 'low') matchAvailability = p.stock > 0 && p.stock <= p.minStock;
    if (availabilityFilter === 'out') matchAvailability = p.stock <= 0;
    return matchSearch && matchCategory && matchAvailability;
  });

  const categories = Array.from(new Set(products.map((p) => p.categoria).filter(Boolean))).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos em stock</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Pesquisar por nome ou código"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="app-input pl-10"
              />
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#607286]"><circle cx="11" cy="11" r="8"/><path d="m21 21l-4.35-4.35"/></svg>
            </div>
            <select value={categoryFilter} onChange={(e) => onCategoryChange?.(e.target.value)} className="app-input">
              <option value="">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select value={availabilityFilter} onChange={(e) => onAvailabilityChange?.(e.target.value)} className="app-input">
              <option value="">Disponibilidade</option>
              <option value="stock">Com stock</option>
              <option value="low">Stock baixo</option>
              <option value="out">Sem stock</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center">
              <p className="font-semibold text-[#344a60]">Nenhum produto encontrado.</p>
              <p className="mt-1 text-sm text-[#708195]">Ajuste os filtros ou registe um produto em “Produtos e serviços”.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Preço (Kz)</th>
                    <th>Stock</th>
                    <th>Mínimo</th>
                    <th>Categoria</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const status = getStockStatus(Number(product.stock), Number(product.minStock));
                    return (
                      <tr key={product.id} className="transition hover:bg-[#f8fafc]">
                        <td className="font-mono text-xs text-[#64768a]">{product.codigo || 'SEM-COD'}</td>
                        <td className="font-semibold text-[#263c52]">{product.name}</td>
                        <td className="tabular-nums font-medium">{typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</td>
                        <td className="tabular-nums">{product.stock}</td>
                        <td className="tabular-nums">{product.minStock}</td>
                        <td className="text-[#607286]">{product.categoria}</td>
                        <td>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
