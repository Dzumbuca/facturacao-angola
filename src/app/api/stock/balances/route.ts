import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouseId');
  const productId = searchParams.get('productId');
  const where: any = { tenantId };
  if (warehouseId) where.warehouseId = warehouseId;
  if (productId) where.productId = productId;
  const balances = await runWithTenant(tenantId, async (tx) => {
    return tx.productWarehouseStock.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, codigo: true, categoria: true, price: true } },
        warehouse: { select: { id: true, name: true } },
        lot: { select: { id: true, lotNumber: true, expiryDate: true } },
      },
      orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
    });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(balances);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { productId, warehouseId, lotId, quantity, minStock, location } = body || {};
  if (!productId || !warehouseId || quantity === undefined) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  try {
    const balance = await runWithTenant(tenantId, async (tx) => {
      const [product, warehouse] = await Promise.all([
        tx.product.findFirst({ where: { id: productId, tenantId } }),
        tx.warehouse.findFirst({ where: { id: warehouseId, tenantId } }),
      ]);
      if (!product || !warehouse) throw new Error('NOT_FOUND');
      const lotIdValue = lotId || null;
      // Schema atual sem composite unique: upsert seguro por lock transacional + find/update/create.
      try {
        if (typeof tx.$executeRaw === 'function') {
          const key = `${tenantId}|${productId}|${warehouseId}|${lotIdValue ?? ''}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`;
        } else if (!(process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')) {
          throw new Error('PWS_UPSERT_REQUIRES_TRANSACTION');
        }
      } catch (err) {
        if (!(process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')) throw err;
      }
      const existing = await tx.productWarehouseStock.findFirst({ where: { tenantId, productId, warehouseId, lotId: lotIdValue } });
      const q = Number(quantity);
      const patch: any = { quantity: { increment: q } };
      if (minStock !== undefined) patch.minStock = Number(minStock);
      if (location !== undefined) patch.location = location || null;
      if (existing?.id) return tx.productWarehouseStock.update({ where: { id: existing.id }, data: patch });
      return tx.productWarehouseStock.create({
        data: { tenantId, productId, warehouseId, lotId: lotIdValue, quantity: q, minStock: minStock !== undefined ? Number(minStock) : 0, location: location || null },
      });
    }, { userId: getSessionUserId(session) });
    return NextResponse.json(balance, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Produto ou armazém não encontrado' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
