import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { action } = body || {};
  try {
    const result = await runWithTenant(tenantId, async (tx) => {
      const resv = await tx.stockReservation.findFirst({ where: { id, tenantId } });
      if (!resv) throw new Error('NOT_FOUND');
      if (resv.status !== 'ACTIVE') throw new Error('INVALID_ACTION');
      const now = new Date();

      if (action === 'RELEASE' || action === 'EXPIRE') {
        const status = action === 'RELEASE' ? 'RELEASED' : 'EXPIRED';
        const prodUpd = await tx.product.updateMany({ where: { id: resv.productId, tenantId }, data: { stock: { increment: resv.quantity } } });
        if (prodUpd.count === 0) throw new Error('NOT_FOUND');
        if (resv.stockId) {
          await tx.productWarehouseStock.updateMany({
            where: { id: resv.stockId, tenantId },
            data: { quantity: { increment: resv.quantity }, reservedQuantity: { decrement: Math.min(resv.quantity, Number.MAX_SAFE_INTEGER) } },
          }).catch(() => null);
        }
        const upd = await tx.stockReservation.updateMany({ where: { id, tenantId, status: 'ACTIVE' }, data: { status, releasedAt: now } });
        if (upd.count === 0) throw new Error('INVALID_ACTION');
        return { ...resv, status, releasedAt: now };
      }

      if (action === 'FULFILL') {
        // Consumes reserved stock (already decremented from available on create).
        if (resv.stockId) {
          await tx.productWarehouseStock.updateMany({ where: { id: resv.stockId, tenantId }, data: { reservedQuantity: { decrement: Math.min(resv.quantity, Number.MAX_SAFE_INTEGER) } } }).catch(() => null);
        }
        const upd = await tx.stockReservation.updateMany({ where: { id, tenantId, status: 'ACTIVE' }, data: { status: 'FULFILLED', releasedAt: now } });
        if (upd.count === 0) throw new Error('INVALID_ACTION');
        return { ...resv, status: 'FULFILLED', releasedAt: now };
      }
      throw new Error('INVALID_ACTION');
    }, { userId: (session?.user as any)?.id });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
    if (e?.message === 'INVALID_ACTION') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
