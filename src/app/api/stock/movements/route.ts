import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 50;
const VALID_TYPES = ['IN', 'OUT', 'ADJUSTMENT'] as const;

type MovementWhere = {
  tenantId: string;
  type?: string;
  productId?: string;
  warehouseId?: string;
  createdAt?: { gte?: Date; lte?: Date };
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const page = parsePositiveInt(url.searchParams.get('page'), 1);
  const requestedLimit = parsePositiveInt(url.searchParams.get('limit'), DEFAULT_PAGE_LIMIT);
  const limit = Math.min(MAX_PAGE_LIMIT, requestedLimit);

  const type = url.searchParams.get('type');
  const productId = url.searchParams.get('productId');
  const warehouseId = url.searchParams.get('warehouseId');
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));

  const where: MovementWhere = { tenantId };
  if (type && (VALID_TYPES as readonly string[]).includes(type)) where.type = type;
  if (productId) where.productId = productId;
  if (warehouseId) where.warehouseId = warehouseId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const result = await runWithTenant(tenantId, async (tx) => {
    const total = await tx.stockMovement.count({ where });
    const items = await tx.stockMovement.findMany({
      where,
      include: { product: { select: { name: true, codigo: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }, { userId: getSessionUserId(session) });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { productId, type, quantity, reason, reference, warehouseId, lotId, idempotencyKey } = body;

  if (!productId || !type || !quantity || Number(quantity) <= 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  if (!warehouseId) {
    return NextResponse.json({ error: 'Armazem e obrigatorio' }, { status: 400 });
  }
  if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  const userId = getSessionUserId(session);
  const qty = Number(quantity);
  const lotIdValue = lotId || null;
  const idemKey = idempotencyKey || `movement-${crypto.randomUUID()}`;

  try {
    const movement = await runWithTenant(tenantId, async (tx) => {
      const existing = await tx.stockMovement.findFirst({ where: { tenantId, idempotencyKey: idemKey } });
      if (existing) return existing;

      const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
      if (!product) throw new Error('NOT_FOUND');

      const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true } });
      if (!warehouse) throw new Error('WAREHOUSE_NOT_FOUND');

      if (type === 'OUT') {
        const pws = await tx.productWarehouseStock.findFirst({ where: { tenantId, productId, warehouseId, lotId: lotIdValue as any } });
        const available = Number(pws?.quantity || 0);
        if (available < qty) throw new Error('INSUFFICIENT');
        await tx.productWarehouseStock.update({ where: { id: pws!.id }, data: { quantity: { decrement: qty } } });
        const updated = await tx.product.updateMany({
          where: { id: productId, tenantId, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (updated.count === 0) throw new Error('INSUFFICIENT');
      } else {
        await tx.productWarehouseStock.upsert({
          where: { tenantId_productId_warehouseId_lotId: { tenantId, productId, warehouseId, lotId: lotIdValue as any } },
          update: { quantity: { increment: qty } },
          create: { tenantId, productId, warehouseId, lotId: lotIdValue, quantity: qty },
        });
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: qty } },
        });
      }

      let quantitySigned: number;
      if (type === 'IN') quantitySigned = qty;
      else if (type === 'OUT') quantitySigned = -qty;
      else quantitySigned = Math.abs(qty);

      return tx.stockMovement.create({
        data: { tenantId, productId, warehouseId, type, quantity: qty, quantitySigned, reason, reference, createdByUserId: userId, idempotencyKey: idemKey },
      });
    }, { userId });

    return NextResponse.json(movement, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    if (e?.message === 'WAREHOUSE_NOT_FOUND') return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 });
    if (e?.message === 'INSUFFICIENT') return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
