import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-db';

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { productId, fromWarehouseId, toWarehouseId, quantity, reason } = body;

  if (!productId || !fromWarehouseId || !toWarehouseId || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json({ error: 'Armazéns de origem e destino devem ser diferentes' }, { status: 400 });
  }

  const userId = (session?.user as any)?.id;

  try {
    const result = await runWithTenant(tenantId, async (tx) => {
      const [product, fromWh, toWh] = await Promise.all([
        tx.product.findFirst({ where: { id: productId, tenantId } }),
        tx.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId, isActive: true } }),
        tx.warehouse.findFirst({ where: { id: toWarehouseId, tenantId, isActive: true } }),
      ]);

      if (!product) throw new Error('PRODUCT_NOT_FOUND');
      if (!fromWh || !toWh) throw new Error('WAREHOUSE_NOT_FOUND');
      if (product.stock < quantity) throw new Error('INSUFFICIENT');

      const transferRef = `TRF-${crypto.randomUUID()}`;
      const out = await tx.stockMovement.create({
        data: { tenantId, productId, type: 'OUT', quantity, reason: reason || `Transferência para ${toWh.name}`, reference: transferRef, createdByUserId: userId },
      });
      const inn = await tx.stockMovement.create({
        data: { tenantId, productId, type: 'IN', quantity, reason: reason || `Transferência de ${fromWh.name}`, reference: transferRef, createdByUserId: userId },
      });
      return { out, in: inn };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    if (e?.message === 'WAREHOUSE_NOT_FOUND') return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 });
    if (e?.message === 'INSUFFICIENT') return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
