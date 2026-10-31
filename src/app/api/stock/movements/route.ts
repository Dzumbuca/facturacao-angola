import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const movements = await runWithTenant(tenantId, async (tx) => {
    return tx.stockMovement.findMany({
      where: { tenantId },
      include: { product: { select: { name: true, codigo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });
  return NextResponse.json(movements);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { productId, type, quantity, reason, reference } = body;

  if (!productId || !type || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  const userId = (session?.user as any)?.id;

  try {
    const movement = await runWithTenant(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
      if (!product) throw new Error('NOT_FOUND');

      if (type === 'OUT') {
        const updated = await tx.product.updateMany({
          where: { id: productId, tenantId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (updated.count === 0) throw new Error('INSUFFICIENT');
      } else {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: quantity } },
        });
      }

      return tx.stockMovement.create({
        data: { tenantId, productId, type, quantity, reason, reference, createdByUserId: userId },
      });
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    if (e?.message === 'INSUFFICIENT') return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
