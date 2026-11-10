'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StockKpiGrid } from '@/components/warehouses/StockKpiGrid';
import { StockActions } from '@/components/warehouses/StockActions';
import { MovementModal } from '@/components/warehouses/MovementModal';
import { TransferModal } from '@/components/warehouses/TransferModal';
import { ProductList } from '@/components/warehouses/ProductList';
import { MovementList } from '@/components/warehouses/MovementList';

type Product = { id: string; name: string; codigo: string | null; stock: number; minStock: number; categoria: string };
type Warehouse = { id: string; name: string };
type Kpis = { totalProducts: number; totalStock: number; lowStock: number; outOfStock: number };

type Movement = {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  product: { name: string; codigo: string | null } | null;
};

export function StockDashboard({
  products,
  warehouses,
  kpis,
  movements: initialMovements,
}: {
  products: Product[];
  warehouses: Warehouse[];
  kpis: Kpis;
  movements: Movement[];
}) {
  const [movementOpen, setMovementOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [movements, setMovements] = useState<Movement[]>(initialMovements);

  function refreshMovements() {
    fetch('/api/stock/movements?limit=50', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: any) => setMovements(Array.isArray(d) ? d : (d?.items ?? [])))
      .catch(() => {});
  }

  function handleMovementSuccess() {
    refreshMovements();
  }

  function handleTransferSuccess() {
    refreshMovements();
  }

  const hasWarehouses = warehouses.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">Gestão de inventário</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Armazém e stock</h1>
          <p className="mt-2 text-sm text-[#707286]">Consulte o stock, registe entradas e saídas, e transfira produtos entre armazéns.</p>
        </div>
        <div className="flex">
          <Link href="/warehouses" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#cbd3de] bg-white px-4 py-2 text-sm font-semibold text-[#344256] transition hover:bg-[#f5f7fa] sm:w-auto">
            Gerir armazéns
          </Link>
        </div>
      </div>

      <StockKpiGrid
        kpis={[
          { label: 'Produtos', value: kpis.totalProducts, tone: 'blue' },
          { label: 'Stock total', value: kpis.totalStock, tone: 'green' },
          { label: 'Stock baixo', value: kpis.lowStock, tone: 'amber' },
          { label: 'Sem stock', value: kpis.outOfStock, tone: 'red' },
        ]}
      />

      <StockActions
        actions={[
          {
            key: 'entry',
            label: 'Entrada',
            icon: 'plus',
            description: 'Registar entrada de stock',
            disabled: !hasWarehouses,
            onClick: () => setMovementOpen(true),
          },
          {
            key: 'exit',
            label: 'Saída',
            icon: 'download',
            description: 'Registar saída de stock',
            disabled: !hasWarehouses,
            onClick: () => setMovementOpen(true),
          },
          {
            key: 'transfer',
            label: 'Transferir',
            icon: 'share',
            description: 'Mover stock entre armazéns',
            disabled: !hasWarehouses,
            onClick: () => setTransferOpen(true),
          },
          {
            key: 'adjust',
            label: 'Ajustar',
            icon: 'settings',
            description: 'Ajuste de inventário',
            disabled: !hasWarehouses,
            onClick: () => setMovementOpen(true),
          },
        ]}
      />

      {!hasWarehouses && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Crie um armazém</strong> antes de registar movimentos ou transferências.{' '}
          <Link href="/warehouses" className="font-semibold text-[#021f87] underline">Ir para armazéns →</Link>
        </div>
      )}

      <ProductList
        products={products}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        availabilityFilter={availabilityFilter}
        onAvailabilityChange={setAvailabilityFilter}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#1c2d3f]">Histórico de movimentos</h2>
        <span className="text-xs text-[#708195]">{movements.length} registos</span>
      </div>
      <MovementList movements={movements} />

      <MovementModal
        products={products.map((p) => ({ id: p.id, name: p.name, codigo: p.codigo, stock: p.stock }))}
        warehouses={warehouses}
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        onSuccess={handleMovementSuccess}
      />

      <TransferModal
        products={products.map((p) => ({ id: p.id, name: p.name, codigo: p.codigo, stock: p.stock }))}
        warehouses={warehouses}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSuccess={handleTransferSuccess}
      />
    </div>
  );
}