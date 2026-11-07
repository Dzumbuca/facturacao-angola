import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { upsertProductWarehouseStock } from '@/lib/stock-service';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const adjustments = await runWithTenant(tenantId, async (tx) => tx.stockAdjustment.findMany({
    where: { tenantId },
    include: { warehouse: true, items: { include: { product: { select: { name: true, codigo: true } } } } },
    orderBy: { createdAt: 'desc' },
  }), { userId: getSessionUserId(session) });
  return NextResponse.json(adjustments);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { warehouseId, reason, items } = body || {};
  if (!warehouseId || !reason || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const adjustment = await runWithTenant(tenantId, async (tx) => {
      const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, tenantId } });
      if (!warehouse) throw new Error('NOT_FOUND');
      const userId = getSessionUserId(session) || null;
      const adjustmentNumber = 'ADJ-' + Date.now().toString().slice(-8);

      // O modelo StockAdjustmentItem regista contagem física (systemQty/countedQty/difference),
      // por isso o ajuste é criado fechado e o stock é aplicado explicitamente abaixo.
      const adj = await tx.stockAdjustment.create({
        data: {
          tenantId, warehouseId, reason, reference: adjustmentNumber,
          status: 'CLOSED', createdByUserId: userId, closedAt: new Date(),
        },
      });

      for (const it of items) {
        const qty = Number(it.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('INVALID_QTY');
        const isDecrease = it.type === 'DECREASE';
        const lotId = it.lotId || null;

        const product = await tx.product.findFirst({ where: { id: it.productId, tenantId }, select: { id: true } });
        if (!product) throw new Error('NOT_FOUND');

        let pws = await tx.productWarehouseStock.findFirst({
          where: { tenantId, productId: it.productId, warehouseId, lotId: lotId as any },
        });
        if (!pws?.id) {
          pws = await upsertProductWarehouseStock(tx, { tenantId, productId: it.productId, warehouseId, lotId }, { createQuantity: 0, createReservedQuantity: 0 });
        }
        if (!pws?.id) throw new Error('NOT_FOUND');

        const systemQty = Number(pws.quantity || 0);
        if (isDecrease && systemQty < qty) throw new Error('INSUFFICIENT');
        const countedQty = isDecrease ? systemQty - qty : systemQty + qty;

        await tx.stockAdjustmentItem.create({
          data: {
            tenantId,
            adjustmentId: adj.id,
            productId: it.productId,
            stockId: pws.id,
            systemQty,
            countedQty,
            difference: countedQty - systemQty,
          },
        });

        if (isDecrease) {
          await tx.productWarehouseStock.update({ where: { id: pws.id }, data: { quantity: { decrement: qty } } });
          const upd = await tx.product.updateMany({ where: { id: it.productId, tenantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
          if (upd.count === 0) throw new Error('INSUFFICIENT');
          await tx.stockMovement.create({
            data: {
              tenantId, productId: it.productId, warehouseId, type: 'ADJUSTMENT',
              quantity: qty, quantitySigned: -qty, reason, reference: adjustmentNumber,
              createdByUserId: userId, idempotencyKey: 'adj-' + adj.id + '-' + it.productId,
            },
          });
        } else {
          await tx.productWarehouseStock.update({ where: { id: pws.id }, data: { quantity: { increment: qty } } });
          const prodInc = await tx.product.updateMany({ where: { id: it.productId, tenantId }, data: { stock: { increment: qty } } });
          if (prodInc.count === 0) throw new Error('NOT_FOUND');
          await tx.stockMovement.create({
            data: {
              tenantId, productId: it.productId, warehouseId, type: 'ADJUSTMENT',
              quantity: qty, quantitySigned: qty, reason, reference: adjustmentNumber,
              createdByUserId: userId, idempotencyKey: 'adj-' + adj.id + '-' + it.productId,
            },
          });
        }
      }

      return tx.stockAdjustment.findFirst({ where: { id: adj.id, tenantId }, include: { warehouse: true, items: true } });
    }, { userId: getSessionUserId(session) });
    return NextResponse.json(adjustment, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Armazém/produto não encontrado' }, { status: 404 });
    if (e?.message === 'INSUFFICIENT') return NextResponse.json({ error: 'Stock insuficiente para ajuste' }, { status: 400 });
    if (e?.message === 'INVALID_QTY') return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
