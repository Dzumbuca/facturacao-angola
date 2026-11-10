import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { WarehouseManagement } from '@/components/warehouses/warehouse-management';

export default async function WarehousesPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;

  const [warehouses, products, movements] = await Promise.all([
    prisma.warehouse.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.stockMovement.findMany({
      where: { tenantId },
      include: { product: { select: { name: true, codigo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  return (
    <WarehouseManagement
      initialWarehouses={warehouses.map((w: any) => ({
        id: w.id,
        name: w.name,
        location: w.location,
        isDefault: w.isDefault,
        isActive: w.isActive,
        createdAt: w.createdAt.toISOString(),
      }))}
      initialProducts={products.map((p: any) => ({
        id: p.id,
        codigo: p.codigo,
        name: p.name,
        price: Number(p.price),
        stock: p.stock,
        minStock: p.minStock ?? 0,
        categoria: p.categoria,
      }))}
      initialMovements={movements.map((m: any) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        reference: m.reference,
        createdAt: m.createdAt.toISOString(),
        product: m.product ? { name: m.product.name, codigo: m.product.codigo } : null,
      }))}
    />
  );
}