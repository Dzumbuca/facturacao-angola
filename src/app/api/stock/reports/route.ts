import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouseId');
  const productId = searchParams.get('productId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const whereMov: any = { tenantId };
  if (warehouseId) whereMov.warehouseId = warehouseId;
  if (productId) whereMov.productId = productId;
  if (from || to) {
    whereMov.createdAt = {};
    if (from) whereMov.createdAt.gte = new Date(from);
    if (to) whereMov.createdAt.lte = new Date(to);
  }

  const { movements, balances, lots, transfers } = await runWithTenant(tenantId, async (tx) => {
    const [movements, balances, lots, transfers] = await Promise.all([
      tx.stockMovement.findMany({ where: whereMov, include: { product: { select: { name: true, codigo: true } }, warehouse: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      tx.productWarehouseStock.findMany({ where: { tenantId, ...(warehouseId ? { warehouseId } : {}) }, include: { product: true, warehouse: true, lot: true } }),
      tx.stockLot.findMany({ where: { tenantId, ...(productId ? { productId } : {}) }, include: { product: true } }),
      tx.stockTransfer.findMany({ where: { tenantId }, include: { fromWarehouse: true, toWarehouse: true, items: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { movements, balances, lots, transfers };
  }, { userId });

  return NextResponse.json({ movements, balances, lots, transfers, generatedAt: new Date().toISOString() });
}
