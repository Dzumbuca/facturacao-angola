import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { upsertProductWarehouseStock } from '@/lib/stock-service';


function qtyOf(it: any): number {
  const q = Number(it?.quantity ?? it?.quantityReceived);
  return Number.isFinite(q) ? q : NaN;
}

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const receptions = await runWithTenant(tenantId, async (tx) => {
    return tx.purchaseReception.findMany({ where: { tenantId }, include: { purchaseOrder: true, warehouse: true, items: true }, orderBy: { createdAt: 'desc' } });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(receptions);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { purchaseOrderId, warehouseId, items, notes, reference } = body || {};
  if (!purchaseOrderId || !warehouseId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const result = await runWithTenant(tenantId, async (tx) => {
      const userId = getSessionUserId(session) || null;
      const [po, warehouse] = await Promise.all([
        tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, tenantId }, include: { items: true } }),
        tx.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true }, select: { id: true } }),
      ]);
      if (!po || !warehouse) throw new Error('NOT_FOUND');
      if (po.status === 'RECEIVED' || po.status === 'CANCELLED') throw new Error('ALREADY_RECEIVED');

      // Validate items and ownership before mutating.
      for (const it of items) {
        const qty = qtyOf(it);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('INVALID_QTY');
        const poi = po.items.find((x: any) => x.id === it.purchaseOrderItemId && x.productId === it.productId);
        if (!poi) throw new Error('INVALID_ITEM');
        const remaining = Number(poi.quantity) - Number(poi.receivedQty || 0);
        if (qty > remaining + 1e-9) throw new Error('INVALID_QTY');
        const prod = await tx.product.findFirst({ where: { id: it.productId, tenantId }, select: { id: true } });
        if (!prod) throw new Error('NOT_FOUND');
        if (it.lotId) {
          const lot = await tx.stockLot.findFirst({ where: { id: it.lotId, tenantId, productId: it.productId }, select: { id: true } });
          if (!lot) throw new Error('NOT_FOUND');
        }
      }

      const ref = (typeof reference === 'string' && reference.trim()) ? reference.trim() : ('REC-' + Date.now().toString().slice(-8));
      const reception = await tx.purchaseReception.create({
        data: {
          tenantId,
          purchaseOrderId: po.id,
          warehouseId,
          reference: ref,
          createdByUserId: userId,
          notes: notes || null,
          items: {
            create: items.map((it: any) => ({
              quantity: qtyOf(it),
              unitCost: it.unitCost != null ? Number(it.unitCost) : null,
              product: { connect: { tenantId_id: { tenantId, id: it.productId } } },
              purchaseOrderItem: { connect: { tenantId_id: { tenantId, id: it.purchaseOrderItemId } } },
              ...(it.lotId ? { lot: { connect: { tenantId_id: { tenantId, id: it.lotId } } } } : {}),
            })),
          },
        },
        include: { items: true },
      });

      for (const it of items) {
        const qty = qtyOf(it);
        const lotId = it.lotId || null;
        const poiUpd = await tx.purchaseOrderItem.updateMany({
          where: { id: it.purchaseOrderItemId, tenantId, purchaseOrderId: po.id },
          data: { receivedQty: { increment: qty } },
        });
        if (poiUpd.count === 0) throw new Error('INVALID_ITEM');
        const prodUpd = await tx.product.updateMany({ where: { id: it.productId, tenantId }, data: { stock: { increment: qty } } });
        if (prodUpd.count === 0) throw new Error('NOT_FOUND');
        await upsertProductWarehouseStock(tx, { tenantId, productId: it.productId, warehouseId, lotId }, { quantity: qty });


        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: it.productId,
            warehouseId,
            type: 'IN',
            quantity: qty,
            quantitySigned: qty,
            reason: 'Receção ' + ref,
            reference: ref,
            createdByUserId: userId,
            purchaseReceptionId: reception.id,
            idempotencyKey: 'recv-' + reception.id + '-' + it.purchaseOrderItemId + '-' + (lotId || 'nolot'),
          },
        });
      }

      const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { tenantId, purchaseOrderId: po.id }, select: { quantity: true, receivedQty: true } });
      const fullyReceived = refreshedItems.length > 0 && refreshedItems.every((x: any) => Number(x.receivedQty || 0) >= Number(x.quantity) - 1e-9);
      await tx.purchaseOrder.update({
        where: { id: po.id, tenantId },
        data: { status: fullyReceived ? 'RECEIVED' : 'PARCIAL', receivedAt: fullyReceived ? new Date() : null },
      });
      return reception;
    }, { userId: getSessionUserId(session) });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Encomenda/armazém não encontrado' }, { status: 404 });
    if (e?.message === 'ALREADY_RECEIVED') return NextResponse.json({ error: 'Encomenda já recebida/cancelada' }, { status: 409 });
    if (e?.message === 'INVALID_QTY' || e?.message === 'INVALID_ITEM') return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
