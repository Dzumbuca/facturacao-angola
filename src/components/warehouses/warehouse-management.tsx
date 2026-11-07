'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WarehouseIndicators } from './WarehouseIndicators';
import { WarehouseList } from './WarehouseList';
import { ProductStockGrid } from './ProductStockGrid';
import { StockMovementsHistory } from './StockMovementsHistory';

type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type Product = {
  id: string;
  codigo: string | null;
  name: string;
  price: number;
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

function SkeletonRow({ className = '' }: { className?: string }) {
  return <div className={`h-4 bg-[#e7edf3] rounded ${className}`} />;
}

function SkeletonCell({ className = '' }: { className?: string }) {
  return <div className={`h-8 bg-[#e7edf3] rounded ${className}`} />;
}

export function WarehouseManagement({
  initialWarehouses,
  initialProducts,
  initialMovements,
}: {
  initialWarehouses: Warehouse[];
  initialProducts: Product[];
  initialMovements: Movement[];
}) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [deletingWarehouseId, setDeletingWarehouseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');

  function openCreateWarehouse() {
    setEditingWarehouse(null);
    setError('');
    setNotice('');
    setWarehouseModalOpen(true);
  }

  function openEditWarehouse(warehouse: Warehouse) {
    setEditingWarehouse(warehouse);
    setError('');
    setNotice('');
    setWarehouseModalOpen(true);
  }

  async function handleDeleteWarehouse(warehouse: Warehouse) {
    if (!window.confirm(`Apagar o armazém "${warehouse.name}"? Esta acção não pode ser revertida.`)) return;
    setDeletingWarehouseId(warehouse.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/stock/warehouses/${warehouse.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível apagar o armazém.');
        setDeletingWarehouseId(null);
        return;
      }
      setWarehouses((current) => current.filter((entry) => entry.id !== warehouse.id));
      setNotice('Armazém apagado.');
      setDeletingWarehouseId(null);
    } catch {
      setError('Não foi possível comunicar com o servidor. Tente novamente.');
      setDeletingWarehouseId(null);
    }
  }

  async function handleToggleWarehouse(warehouse: Warehouse) {
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/stock/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !warehouse.isActive }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível actualizar o armazém.');
        return;
      }
      setWarehouses((current) => current.map((entry) =>
        entry.id === warehouse.id ? { ...entry, isActive: !warehouse.isActive } : entry
      ));
      setNotice(warehouse.isActive ? 'Armazém desactivado.' : 'Armazém activado.');
    } catch {
      setError('Não foi possível comunicar com o servidor. Tente novamente.');
    }
  }

  async function handleWarehouseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    setIsSaving(true);

    const form = new FormData(formElement);
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      location: String(form.get('location') ?? '').trim() || null,
      isDefault: form.get('isDefault') === 'on',
      isActive: true,
    };

    try {
      const editing = editingWarehouse;
      const response = await fetch(editing ? `/api/stock/warehouses/${editing.id}` : '/api/stock/warehouses', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível guardar o armazém. Tente novamente.');
        return;
      }

      setWarehouses((current) => editing
        ? current.map((entry) => (entry.id === editing.id ? data : entry))
        : [...current, data]);
      setNotice(editing ? 'Armazém actualizado com sucesso.' : 'Armazém criado com sucesso.');
      setWarehouseModalOpen(false);
      setEditingWarehouse(null);
      formElement.reset();
    } catch {
      setError('Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    setIsSaving(true);

    const form = new FormData(formElement);
    const productId = String(form.get('productId') ?? '');
    const type = String(form.get('type') ?? 'IN') as 'IN' | 'OUT' | 'ADJUSTMENT';
    const quantity = Number(form.get('quantity') ?? '1');
    const reason = String(form.get('reason') ?? '').trim() || null;
    const reference = String(form.get('reference') ?? '').trim() || null;

    const selectedProduct = products.find((p) => p.id === productId);

    if (!productId) {
      setError('Selecione um produto.');
      setIsSaving(false);
      return;
    }
    if (type === 'OUT' && selectedProduct && quantity > selectedProduct.stock) {
      setError('Não é possível registar uma saída superior ao stock disponível.');
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, type, quantity, reason, reference }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao registar movimento');
      }

      setMovementModalOpen(false);
      formElement.reset();
      onDataRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const onDataRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [wRes, pRes, mRes] = await Promise.all([
        fetch('/api/stock/warehouses'),
        fetch('/api/produtos'),
        fetch('/api/stock/movements'),
      ]);
      if (wRes.ok) {
        const data = await wRes.json();
        setWarehouses(Array.isArray(data) ? data : []);
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setProducts(Array.isArray(data) ? data : []);
      }
      if (mRes.ok) {
        const data = await mRes.json();
        setMovements(Array.isArray(data) ? data : (data?.items ?? []));
      }
      setNotice('Dados actualizados.');
    } catch {
      setError('Erro ao actualizar dados.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.codigo && p.codigo.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCategory = categoryFilter ? p.categoria === categoryFilter : true;
      let matchAvailability = true;
      if (availabilityFilter === 'stock') matchAvailability = p.stock > 0;
      if (availabilityFilter === 'low') matchAvailability = p.stock > 0 && p.stock <= p.minStock;
      if (availabilityFilter === 'out') matchAvailability = p.stock <= 0;
      return matchSearch && matchCategory && matchAvailability;
    });
  }, [products, searchQuery, categoryFilter, availabilityFilter]);

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStockProducts = products.filter((p) => p.stock <= 0).length;
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-[#708195]">Controlo de inventário</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Armazéns</h2>
          </div>
          <div className="flex gap-2 sm:flex-col sm:gap-3 w-full sm:w-auto">
            <SkeletonRow className="w-32" />
            <SkeletonRow className="w-32" />
          </div>
        </div>
        <Card>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-lg border bg-white p-6 shadow-sm">
                  <SkeletonRow className="w-40" />
                  <SkeletonCell className="mt-2 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <Card>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <SkeletonRow className="w-full" />
                    <SkeletonRow className="w-48" />
                    <SkeletonRow className="w-48" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table min-w-[760px]">
                      <tbody>
                        {[1, 2, 3].map((i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="p-4"><SkeletonRow className="w-16" /></td>
                            <td className="p-4"><SkeletonRow className="w-32" /></td>
                            <td className="p-4"><SkeletonRow className="w-20" /></td>
                            <td className="p-4"><SkeletonRow className="w-12" /></td>
                            <td className="p-4"><SkeletonRow className="w-12" /></td>
                            <td className="p-4"><SkeletonRow className="w-20" /></td>
                            <td className="p-4"><SkeletonRow className="w-16" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="mt-6">
              <Card>
                <CardContent className="p-5">
                  <div className="space-y-4">
                    <SkeletonRow className="w-full" />
                    <div className="overflow-x-auto">
                      <table className="data-table min-w-[760px]">
                        <tbody>
                          {[1, 2, 3].map((i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="p-4"><SkeletonRow className="w-24" /></td>
                              <td className="p-4"><SkeletonRow className="w-32" /></td>
                              <td className="p-4"><SkeletonRow className="w-16" /></td>
                              <td className="p-4"><SkeletonRow className="w-20" /></td>
                              <td className="p-4"><SkeletonRow className="w-32" /></td>
                              <td className="p-4"><SkeletonRow className="w-32" /></td>
                              <td className="p-4"><SkeletonRow className="w-20" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
          <section>
            <Card>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <SkeletonRow className="w-full" />
                  <div className="overflow-x-auto">
                    <table className="data-table min-w-[560px]">
                      <tbody>
                        {[1, 2, 3].map((i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="p-4"><SkeletonRow className="w-32" /></td>
                            <td className="p-4"><SkeletonRow className="w-32" /></td>
                            <td className="p-4"><SkeletonRow className="w-20" /></td>
                            <td className="p-4"><SkeletonRow className="w-16" /></td>
                            <td className="p-4"><SkeletonRow className="w-20" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <SkeletonRow className="w-40" />
                  <SkeletonCell className="mt-2 w-24" />
                </div>
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <SkeletonRow className="w-40" />
                  <SkeletonCell className="mt-2 w-24" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">Controlo de inventário</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Armazéns</h2>
          <p className="mt-2 text-sm text-[#708195]">Gerencie armazéns, produtos em stock e histórico de movimentações.</p>
        </div>
        <div className="flex gap-2 sm:flex-col sm:gap-3 w-full sm:w-auto">
          <Button type="button" onClick={openCreateWarehouse} disabled={isSaving}>
            Novo armazém
          </Button>
          <Button type="button" onClick={() => setMovementModalOpen(true)} variant="secondary" disabled={isSaving || products.length === 0}>
            Novo movimento
          </Button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm font-medium text-[#267256]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}

      <WarehouseIndicators
        totalProducts={totalProducts}
        totalStock={totalStock}
        lowStockProducts={lowStockProducts}
        outOfStockProducts={outOfStockProducts}
        totalValue={totalValue}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <ProductStockGrid
            products={filteredProducts}
            searchQuery={searchQuery}
            categoryFilter={categoryFilter}
            availabilityFilter={availabilityFilter}
            onSearchChange={setSearchQuery}
            onCategoryChange={setCategoryFilter}
            onAvailabilityChange={setAvailabilityFilter}
          />

          <div className="mt-6">
          <StockMovementsHistory
            movements={movements}
          />
          </div>
        </section>

        <section>
          <WarehouseList
            warehouses={warehouses}
            onEdit={openEditWarehouse}
            onToggle={handleToggleWarehouse}
            onDelete={handleDeleteWarehouse}
            deletingId={deletingWarehouseId}
          />

          <div className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-[#708195]">Total de armazéns</p>
                  <p className="mt-1 text-2xl font-bold text-[#1c2d3f]">{warehouses.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-[#708195]">Armazéns activos</p>
                  <p className="mt-1 text-2xl font-bold text-[#248468]">{warehouses.filter((w) => w.isActive).length}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>

      {warehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setWarehouseModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="warehouse-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Controlo de inventário</p>
                <h3 id="warehouse-form-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">{editingWarehouse ? 'Editar armazém' : 'Novo armazém'}</h3>
                <p className="mt-1 text-sm text-[#708195]">Preencha os dados do armazém.</p>
              </div>
              <button type="button" aria-label="Fechar" disabled={isSaving} onClick={() => setWarehouseModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
            </div>
            <form className="space-y-4" onSubmit={(e) => handleWarehouseSubmit(e)} key={editingWarehouse?.id ?? 'novo'}>
              <div>
                <label htmlFor="warehouse-name" className="app-label">Nome do armazém <span className="text-[#c44747]">*</span></label>
                <input id="warehouse-name" name="name" className="app-input" maxLength={160} required autoFocus defaultValue={editingWarehouse?.name ?? ''} />
              </div>
              <div>
                <label htmlFor="warehouse-location" className="app-label">Localização <span className="font-normal text-[#708195]">(opcional)</span></label>
                <input id="warehouse-location" name="location" className="app-input" defaultValue={editingWarehouse?.location ?? ''} />
              </div>
              <div className="flex items-start gap-3">
                <input id="warehouse-isdefault" name="isDefault" type="checkbox" className="h-5 w-5 text-[#2878d0] border-[#dce2e9] focus:ring-2 focus:ring-[#2878d0]" defaultChecked={editingWarehouse?.isDefault ?? false} />
                <label htmlFor="warehouse-isdefault" className="text-sm text-[#607286] leading-none cursor-pointer">
                  Armazém predefinido
                </label>
              </div>
              {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setWarehouseModalOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'A guardar…' : editingWarehouse ? 'Guardar alterações' : 'Criar armazém'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {movementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setMovementModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="movement-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Controlo de inventário</p>
                <h3 id="movement-form-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">Registar movimento de stock</h3>
                <p className="mt-1 text-sm text-[#708195]">Registe uma entrada, saída ou ajuste de stock.</p>
              </div>
              <button type="button" aria-label="Fechar" disabled={isSaving} onClick={() => setMovementModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
            </div>
            <form className="space-y-4" onSubmit={(e) => handleMovementSubmit(e)} key="movement-form">
              <div>
                <label htmlFor="movement-product" className="app-label">Produto <span className="text-[#c44747]">*</span></label>
                <select id="movement-product" name="productId" className="app-input" required>
                  <option value="">Seleccionar produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.codigo || 'SEM-COD'}) — Stock: {product.stock}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="movement-type" className="app-label">Tipo de movimento <span className="text-[#c44747]">*</span></label>
                  <select id="movement-type" name="type" className="app-input" required>
                    <option value="IN">Entrada</option>
                    <option value="OUT">Saída</option>
                    <option value="ADJUSTMENT">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="movement-quantity" className="app-label">Quantidade <span className="text-[#c44747]">*</span></label>
                  <input id="movement-quantity" name="quantity" type="number" className="app-input tabular-nums" min="1" step="1" required defaultValue="1" />
                </div>
              </div>
              <div>
                <label htmlFor="movement-reason" className="app-label">Motivo</label>
                <input id="movement-reason" name="reason" className="app-input" placeholder="Motivo do movimento" />
              </div>
              <div>
                <label htmlFor="movement-reference" className="app-label">Referência <span className="font-normal text-[#708195]">(opcional)</span></label>
                <input id="movement-reference" name="reference" className="app-input" placeholder="Referência (opcional)" />
              </div>
              {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setMovementModalOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'A registar…' : 'Registar movimento'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
