import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { StockClient } from './stock-client';
import { StockHistory } from './stock-history';
import { TransferForm } from './transfer-form';
import { TransferList } from './transfer-list';
import { WarehouseManager } from './warehouse-manager';
import { StockOperationsNav } from './stock-operations-nav';

export default async function StockPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;

  const products = await prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  const warehouses = await prisma.warehouse.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });

  const totalProducts = products.length;
  const totalStock = products.reduce((s: number, p: any) => s + (p.stock || 0), 0);
  const lowStock = products.filter((p: any) => (p.stock || 0) <= (p.minStock || 0));
  const outOfStock = products.filter((p: any) => (p.stock || 0) <= 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Machine Stock</h1>

      <StockOperationsNav />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Produtos</div>
          <div className="text-2xl font-bold">{totalProducts}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Stock total</div>
          <div className="text-2xl font-bold">{totalStock}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Stock baixo</div>
          <div className="text-2xl font-bold text-amber-600">{lowStock.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Sem stock</div>
          <div className="text-2xl font-bold text-red-600">{outOfStock.length}</div>
        </div>
      </div>

      <StockClient
        products={products.map((p: any) => ({ id: p.id, name: p.name, stock: p.stock }))}
        warehouses={warehouses.map((w: any) => ({ id: w.id, name: w.name }))}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WarehouseManager warehouses={warehouses.map((w: any) => ({ id: w.id, name: w.name, location: w.location }))} />
        <TransferForm products={products.map((p: any) => ({ id: p.id, name: p.name }))} warehouses={warehouses.map((w: any) => ({ id: w.id, name: w.name }))} />
      </div>
      <TransferList />

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Produto</th>
              <th className="text-left p-2">Código</th>
              <th className="text-left p-2">Categoria</th>
              <th className="text-right p-2">Stock</th>
              <th className="text-right p-2">Mínimo</th>
              <th className="text-center p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => {
              const low = (p.stock || 0) <= (p.minStock || 0);
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.codigo || '-'}</td>
                  <td className="p-2">{p.categoria}</td>
                  <td className="p-2 text-right">{p.stock}</td>
                  <td className="p-2 text-right">{p.minStock}</td>
                  <td className="p-2 text-center">
                    {p.stock <= 0 ? (
                      <span className="text-red-600 font-medium">Sem stock</span>
                    ) : low ? (
                      <span className="text-amber-600 font-medium">Baixo</span>
                    ) : (
                      <span className="text-green-600 font-medium">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  Nenhum produto registado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-semibold mt-6">Histórico de movimentos</h2>
      <StockHistory />
    </div>
  );
}
