import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { StockDashboard } from './stock-dashboard';
import { StockOperationsNav } from './stock-operations-nav';

export default async function StockPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;

  const [products, warehouses, movements] = await Promise.all([
    prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.warehouse.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.stockMovement.findMany({
      where: { tenantId },
      include: { product: { select: { name: true, codigo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const totalProducts = products.length;
  const totalStock = products.reduce((s: number, p: any) => s + Number(p.stock || 0), 0);
  const lowStock = products.filter((p: any) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= Number(p.minStock || 0));
  const outOfStock = products.filter((p: any) => Number(p.stock || 0) <= 0);

  return (
    <div className="space-y-6">
      <StockDashboard
        products={products.map((p: any) => ({
          id: p.id,
          name: p.name,
          codigo: p.codigo,
          stock: p.stock,
          minStock: p.minStock ?? 0,
          categoria: p.categoria,
        }))}
        warehouses={warehouses.map((w: any) => ({ id: w.id, name: w.name }))}
        kpis={{
          totalProducts,
          totalStock,
          lowStock: lowStock.length,
          outOfStock: outOfStock.length,
        }}
        movements={movements.map((m: any) => ({
          id: m.id,
          type: m.type,
          quantity: m.quantity,
          reason: m.reason,
          reference: m.reference,
          createdAt: m.createdAt.toISOString(),
          product: m.product ? { name: m.product.name, codigo: m.product.codigo } : null,
        }))}
      />
      <StockOperationsNav />
    </div>
  );
}