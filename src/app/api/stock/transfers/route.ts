import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const transfers = await runWithTenant(tenantId, async (tx) => {
    return tx.stockTransfer.findMany({ where: { tenantId }, include: { fromWarehouse: true, toWarehouse: true, items: true, receptions: true }, orderBy: { createdAt: 'desc' } });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(transfers);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { fromWarehouseId, toWarehouseId, items } = body;
  if (!fromWarehouseId || !toWarehouseId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json({ error: 'Armazéns devem ser diferentes' }, { status: 400 });
  }
  try {
    const transfer = await runWithTenant(tenantId, async (tx) => {
      const [fromWh, toWh] = await Promise.all([
        tx.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId } }),
        tx.warehouse.findFirst({ where: { id: toWarehouseId, tenantId } }),
      ]);
      if (!fromWh || !toWh) throw new Error('WAREHOUSE_NOT_FOUND');
      const productIds = Array.from(new Set(items.map((it: any) => it.productId).filter(Boolean))) as string[];
      if (productIds.length === 0) throw new Error('PRODUCT_NOT_FOUND');
      const found = await tx.product.findMany({ where: { tenantId, id: { in: productIds } }, select: { id: true } });
      if (found.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND');
      const reference = 'TRF-' + Date.now().toString().slice(-8);
      return tx.stockTransfer.create({
        data: {
          tenantId,
          fromWarehouseId,
          toWarehouseId,
          reference,
          status: 'PENDING',
          createdByUserId: getSessionUserId(session),
          items: {
            create: items.map((it: any) => ({
              quantity: Number(it.quantity),
              receivedQty: 0,
              rejectedQty: 0,
              product: { connect: { tenantId_id: { tenantId, id: it.productId } } },
              ...(it.lotId ? { lot: { connect: { tenantId_id: { tenantId, id: it.lotId } } } } : {}),
            })),
          },
        },
        include: { items: true, fromWarehouse: true, toWarehouse: true },
      });
    }, { userId: getSessionUserId(session) });
    return NextResponse.json(transfer, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'WAREHOUSE_NOT_FOUND') return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 });
    if (e?.message === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
