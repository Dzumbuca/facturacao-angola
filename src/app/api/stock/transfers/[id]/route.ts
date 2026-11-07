import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { upsertProductWarehouseStock } from '@/lib/stock-service';


export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const transfer = await runWithTenant(tenantId, async (tx) => tx.stockTransfer.findFirst({ where: { id, tenantId }, include: { fromWarehouse: true, toWarehouse: true, items: { include: { product: true, lot: true } }, receptions: true } }), { userId: getSessionUserId(session) });
  if (!transfer) return NextResponse.json({ error: 'Transferência não encontrada' }, { status: 404 });
  return NextResponse.json(transfer);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { action } = body;
  try {
    const result = await runWithTenant(tenantId, async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({ where: { id, tenantId }, include: { items: true } });
      if (!transfer) throw new Error('NOT_FOUND');
      const userId = getSessionUserId(session) || null;
      if (action === 'DISPATCH') {
        if (transfer.status !== 'PENDING') throw new Error('INVALID_ACTION');
        for (const it of transfer.items) {
          const qty = Number(it.quantity);
          const lotId = (it as any).lotId || null;
          const pws = await tx.productWarehouseStock.findFirst({ where: { tenantId, productId: it.productId, warehouseId: transfer.fromWarehouseId, lotId: lotId as any } });
          const available = Number(pws?.quantity || 0);
          if (available < qty) throw new Error('INSUFFICIENT');
          await tx.productWarehouseStock.update({ where: { id: pws!.id }, data: { quantity: { decrement: qty } } });
          const dec = await tx.product.updateMany({ where: { id: it.productId, tenantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
          if (dec.count === 0) throw new Error('INSUFFICIENT');
          await tx.stockMovement.create({ data: { tenantId, productId: it.productId, warehouseId: transfer.fromWarehouseId, transferId: transfer.id, type: 'OUT', quantity: qty, quantitySigned: -qty, reason: 'Expedição transferência ' + (transfer.reference || id), reference: transfer.reference || id, createdByUserId: userId, idempotencyKey: 'tfr-out-' + transfer.id + '-' + it.id + '-' + (lotId || 'nolot') } });
        }
        return tx.stockTransfer.update({ where: { id }, data: { status: 'IN_TRANSIT' } });
      }
      if (action === 'RECEIVE') {
        if (transfer.status !== 'IN_TRANSIT') throw new Error('INVALID_ACTION');
        const reception = await tx.stockTransferReception.create({
          data: {
            tenantId, transferId: transfer.id, warehouseId: transfer.toWarehouseId,
            reference: 'TRR-' + Date.now().toString().slice(-8),
            createdByUserId: userId,
            items: { create: transfer.items.map((it: any) => ({
              quantity: it.quantity,
              rejectedQty: 0,
              product: { connect: { tenantId_id: { tenantId, id: it.productId } } },
              transferItem: { connect: { tenantId_id: { tenantId, id: it.id } } },
              ...(it.lotId ? { lot: { connect: { tenantId_id: { tenantId, id: it.lotId } } } } : {}),
            })) },
          },
          include: { items: true },
        });
        for (const it of transfer.items) {
          const qty = Number(it.quantity);
          const lotId = (it as any).lotId || null;
          await upsertProductWarehouseStock(tx, { tenantId, productId: it.productId, warehouseId: transfer.toWarehouseId, lotId }, { quantity: qty });

          const prodInc = await tx.product.updateMany({ where: { id: it.productId, tenantId }, data: { stock: { increment: qty } } });
          if (prodInc.count === 0) throw new Error('NOT_FOUND');
          await tx.stockMovement.create({ data: { tenantId, productId: it.productId, warehouseId: transfer.toWarehouseId, transferId: transfer.id, transferReceptionId: reception.id, type: 'IN', quantity: qty, quantitySigned: qty, reason: 'Receção transferência ' + (transfer.reference || id), reference: transfer.reference || id, createdByUserId: userId, idempotencyKey: 'tfr-in-' + transfer.id + '-' + it.id + '-' + (lotId || 'nolot') } });
          await tx.stockTransferItem.updateMany({ where: { id: it.id, tenantId }, data: { receivedQty: qty } });
        }
        return tx.stockTransfer.update({ where: { id }, data: { status: 'RECEIVED', receivedAt: new Date() } });
      }
      if (action === 'CANCEL') {
        if (transfer.status === 'RECEIVED') throw new Error('INVALID_ACTION');
        if (transfer.status !== 'PENDING' && transfer.status !== 'IN_TRANSIT') throw new Error('INVALID_ACTION');
        return tx.stockTransfer.update({ where: { id }, data: { status: 'CANCELLED' } });
      }
      throw new Error('INVALID_ACTION');
    }, { userId: getSessionUserId(session) });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Transferência não encontrada' }, { status: 404 });
    if (e?.message === 'INSUFFICIENT') return NextResponse.json({ error: 'Stock insuficiente na origem' }, { status: 400 });
    if (e?.message === 'INVALID_ACTION') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
