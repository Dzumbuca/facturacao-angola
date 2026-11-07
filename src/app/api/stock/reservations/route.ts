import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { upsertProductWarehouseStock } from '@/lib/stock-service';

async function findPws(tx: any, tenantId: string, productId: string, warehouseId: string, lotId: string | null) {
  return tx.productWarehouseStock.findFirst({ where: { tenantId, productId, warehouseId, lotId: lotId ?? null } });
}


export async function GET(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const where: any = { tenantId };
  if (status) where.status = status;
  const reservations = await runWithTenant(tenantId, async (tx) => tx.stockReservation.findMany({ where, include: { product: true, warehouse: true, stock: true }, orderBy: { createdAt: 'desc' } }), { userId: getSessionUserId(session) });
  return NextResponse.json(reservations);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { productId, warehouseId, quantity, orderReference, expiresAt, stockId, lotId } = body || {};
  if (!productId || !warehouseId || !quantity) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  try {
    const reservation = await runWithTenant(tenantId, async (tx) => {
      const [product, warehouse] = await Promise.all([
        tx.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } }),
        tx.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true }, select: { id: true } }),
      ]);
      if (!product || !warehouse) throw new Error('NOT_FOUND');
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('INVALID_QTY');

      const resolvedLotId = lotId || null;
      let pws = stockId
        ? await tx.productWarehouseStock.findFirst({ where: { id: stockId, tenantId, productId, warehouseId } })
        : await findPws(tx, tenantId, productId, warehouseId, resolvedLotId);
      if (!pws) {
        // Bootstrap PWS row (concurrency-safe) when none exists.
        pws = await upsertProductWarehouseStock(tx, { tenantId, productId, warehouseId, lotId: resolvedLotId }, { createQuantity: 0, createReservedQuantity: 0 });
      }
      if (!pws?.id) throw new Error('NOT_FOUND');


      // Reserve in PWS (authoritative per warehouse) and keep global product stock consistent.
      const pwsUpd = await tx.productWarehouseStock.updateMany({
        where: { id: pws.id, tenantId, quantity: { gte: qty } },
        data: { quantity: { decrement: qty }, reservedQuantity: { increment: qty } },
      });
      if (pwsUpd.count === 0) {
        // Fallback to global stock only if PWS had no balance but product has legacy global stock.
        const legacy = await tx.product.updateMany({ where: { id: productId, tenantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
        if (legacy.count === 0) throw new Error('INSUFFICIENT');
        await tx.productWarehouseStock.updateMany({ where: { id: pws.id, tenantId }, data: { reservedQuantity: { increment: qty } } });
      } else {
        await tx.product.updateMany({ where: { id: productId, tenantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
      }

      return tx.stockReservation.create({
        data: {
          tenantId,
          productId,
          warehouseId,
          stockId: pws.id,
          quantity: qty,
          orderReference: orderReference || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          status: 'ACTIVE',
        },
      });
    }, { userId: getSessionUserId(session) });
    return NextResponse.json(reservation, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Produto/armazém não encontrado' }, { status: 404 });
    if (e?.message === 'INSUFFICIENT') return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    if (e?.message === 'INVALID_QTY') return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
