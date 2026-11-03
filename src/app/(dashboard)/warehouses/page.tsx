'use client';

import { useEffect, useState } from 'react';
import { WarehouseIndicators } from '@/components/warehouses/WarehouseIndicators';
import { WarehouseList } from '@/components/warehouses/WarehouseList';
import { ProductStockGrid } from '@/components/warehouses/ProductStockGrid';
import { StockMovementsHistory } from '@/components/warehouses/StockMovementsHistory';
import { NewMovementDialog } from '@/components/warehouses/NewMovementDialog';
import { NewWarehouseDialog } from '@/components/warehouses/NewWarehouseDialog';

type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
};

type Product = {
  id: string;
  name: string;
  codigo: string | null;
  price: number | string;
  stock: number;
  minStock: number;
  categoria: string;
};

type Movement = {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  product: { name: string; codigo: string | null } | null;
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [warehousesRes, productsRes, movementsRes] = await Promise.all([
        fetch('/api/stock/warehouses'),
        fetch('/api/produtos'),
        fetch('/api/stock/movements'),
      ]);

      if (warehousesRes.ok) {
        const data = await warehousesRes.json();
        setWarehouses(Array.isArray(data) ? data : []);
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : []);
      }

      if (movementsRes.ok) {
        const data = await movementsRes.json();
        setMovements(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError('Erro ao carregar dados de armazéns e stock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const lowStockProducts = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock)).length;
  const outOfStockProducts = products.filter((p) => Number(p.stock) <= 0).length;
  const totalValue = products.reduce((sum, p) => {
    const price = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
    const stock = Number(p.stock) || 0;
    return sum + price * stock;
  }, 0);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">A carregar...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Armazéns</h1>
          <p className="text-muted-foreground">Gestão de armazéns e controlo de stock</p>
        </div>
        <div className="flex gap-2">
          <NewWarehouseDialog onSuccess={loadData} />
          <NewMovementDialog products={products.map((p) => ({ id: p.id, name: p.name, stock: p.stock }))} onSuccess={loadData} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <WarehouseIndicators
        totalProducts={totalProducts}
        totalStock={totalStock}
        lowStockProducts={lowStockProducts}
        outOfStockProducts={outOfStockProducts}
        totalValue={totalValue}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <WarehouseList warehouses={warehouses} />
        <ProductStockGrid products={products} />
      </div>

      <StockMovementsHistory movements={movements} />
    </div>
  );
}
