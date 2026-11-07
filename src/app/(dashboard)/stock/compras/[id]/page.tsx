import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { PurchaseOrderDetailClient } from './purchase-order-detail-client';

export default async function CompraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const { id } = await params;
  const [order, warehouses, products] = await Promise.all([
    prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { supplier: { select: { name: true } }, items: true } }),
    prisma.warehouse.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  if (!order) return notFound();
  const productsById = Object.fromEntries(products.map((p:any)=>[p.id,p.name]));
  const initialOrder = {
    id: order.id,
    status: order.status,
    total: Number(order.total || 0),
    createdAt: order.createdAt.toISOString(),
    expectedAt: order.expectedAt?.toISOString() || null,
    receivedAt: order.receivedAt?.toISOString() || null,
    supplier: order.supplier ? { name: order.supplier.name } : null,
    items: (order.items||[]).map((i:any)=>({ id:i.id, productId:i.productId, quantity:Number(i.quantity), receivedQty:Number(i.receivedQty||0), productName: productsById[i.productId] })),
  };
  return <PurchaseOrderDetailClient initialOrder={initialOrder} warehouses={warehouses} productsById={productsById} />;
}
