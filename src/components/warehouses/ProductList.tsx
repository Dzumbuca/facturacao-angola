'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockFilters } from './StockFilters';

type Product = {
  id: string;
  name: string;
  codigo: string | null;
  stock: number;
  minStock: number;
  categoria: string;
};

function getStockStatus(stock: number, minStock: number) {
  if (stock <= 0) return { label: 'Sem stock', className: 'bg-[#fdf3f3] text-[#a83939] border border-red-100' };
  if (stock <= minStock) return { label: 'Stock baixo', className: 'bg-[#fdf6e9] text-[#8a5a10] border border-amber-100' };
  return { label: 'OK', className: 'bg-[#eff9f4] text-[#267256] border border-[#cbe8dc]' };
}

export function ProductList({
  products,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  availabilityFilter,
  onAvailabilityChange,
}: {
  products: Product[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  availabilityFilter: string;
  onAvailabilityChange: (v: string) => void;
}) {
  const categories = Array.from(new Set(products.map((p) => p.categoria).filter(Boolean))).sort();

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos em stock</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <StockFilters
            search={searchQuery}
            onSearchChange={onSearchChange}
            categories={categories}
            category={categoryFilter}
            onCategoryChange={onCategoryChange}
            availability={availabilityFilter}
            onAvailabilityChange={onAvailabilityChange}
          />
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center">
              <p className="font-semibold text-[#344a60]">Nenhum produto encontrado.</p>
              <p className="mt-1 text-sm text-[#708195]">Ajuste os filtros ou registe um produto em "Produtos e serviços".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
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
                        <td data-mobile-primary className="font-semibold text-[#263c52]">{product.name}</td>
                        <td className="tabular-nums">{product.stock}</td>
                        <td className="tabular-nums">{product.minStock}</td>
                        <td className="text-[#607286]">{product.categoria}</td>
                        <td>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
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