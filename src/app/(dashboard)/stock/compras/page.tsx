import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { PurchaseOrdersClient } from './purchase-orders-client';

export default async function ComprasPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const orders = await prisma.purchaseOrder.findMany({
    where: { tenantId },
    include: { supplier: { select: { name: true } }, items: { select: { quantity: true, receivedQty: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const initialOrders = orders.map((o: any) => ({
    id: o.id,
    status: o.status,
    total: Number(o.total || 0),
    createdAt: o.createdAt.toISOString(),
    expectedAt: o.expectedAt?.toISOString() || null,
    receivedAt: o.receivedAt?.toISOString() || null,
    supplier: o.supplier ? { name: o.supplier.name } : null,
    items: (o.items || []).map((i: any) => ({ quantity: Number(i.quantity), receivedQty: Number(i.receivedQty) })),
  }));
  return <PurchaseOrdersClient initialOrders={initialOrders} />;
}
