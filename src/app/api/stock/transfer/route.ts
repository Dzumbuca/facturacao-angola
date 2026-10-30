import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

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

  const [product, fromWh, toWh] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, tenantId } }),
    prisma.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId, isActive: true } }),
    prisma.warehouse.findFirst({ where: { id: toWarehouseId, tenantId, isActive: true } }),
  ]);

  if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
  if (!fromWh || !toWh) return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 });

  if (product.stock < quantity) {
    return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
  }

  const userId = (session?.user as any)?.id;

  const [outMov, inMov] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: { tenantId, productId, type: 'OUT', quantity, reason: reason || `Transferência para ${toWh.name}`, reference: `TRF-${fromWh.id}->${toWh.id}`, createdByUserId: userId },
    }),
    prisma.stockMovement.create({
      data: { tenantId, productId, type: 'IN', quantity, reason: reason || `Transferência de ${fromWh.name}`, reference: `TRF-${fromWh.id}->${toWh.id}`, createdByUserId: userId },
    }),
  ]);

  return NextResponse.json({ out: outMov, in: inMov }, { status: 201 });
}
