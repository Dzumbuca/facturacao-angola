import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const movements = await prisma.stockMovement.findMany({
    where: { tenantId },
    include: { product: { select: { name: true, codigo: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
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

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

  // Prevent negative stock on OUT
  if (type === 'OUT' && product.stock < quantity) {
    return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
  }

  const delta = type === 'IN' ? quantity : type === 'OUT' ? -quantity : quantity;

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: { tenantId, productId, type, quantity, reason, reference },
    }),
    prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } },
    }),
  ]);

  return NextResponse.json(movement, { status: 201 });
}
