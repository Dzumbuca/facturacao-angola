import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { registerPhysicalReturn } from '@/lib/stock-service';

const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 50;
// registerPhysicalReturn grava sempre o movimento com idempotencyKey começada por
// 'return-' (devolução física) ou 'return-nc-' (devolução ligada a nota de crédito).
// Este prefixo é o discriminador estável de devoluções em StockMovement.
const RETURN_PREFIX = 'return-';

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

  const productId = url.searchParams.get('productId');
  const warehouseId = url.searchParams.get('warehouseId');
  const reference = url.searchParams.get('reference');
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));

  const where: any = { tenantId, idempotencyKey: { startsWith: RETURN_PREFIX } };
  if (productId) where.productId = productId;
  if (warehouseId) where.warehouseId = warehouseId;
  if (reference) where.reference = { contains: reference, mode: 'insensitive' };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const result = await runWithTenant(tenantId, async (tx) => {
    const total = await tx.stockMovement.count({ where });
    const items = await tx.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true, codigo: true } },
        warehouse: { select: { name: true } },
      },
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

  const body = await req.json().catch(() => ({}));
  const { productId, warehouseId, quantity, reason, reference, creditNoteId, lotId } = body || {};
  if (!productId || !warehouseId || !quantity || Number(quantity) <= 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  try {
    const result = await registerPhysicalReturn(tenantId, {
      productId,
      warehouseId,
      quantity: Number(quantity),
      reason: reason || 'Devolução física',
      reference,
      creditNoteId,
      createdByUserId: getSessionUserId(session) || undefined,
      lotId: lotId || null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'Produto nao encontrado') return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    if (e?.message === 'Armazem nao encontrado') return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
