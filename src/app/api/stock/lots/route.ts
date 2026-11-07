import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  const where: any = { tenantId };
  if (productId) where.productId = productId;
  const lots = await runWithTenant(tenantId, async (tx) => {
    return tx.stockLot.findMany({ where, include: { product: { select: { id: true, name: true, codigo: true } } }, orderBy: { receivedAt: 'desc' } });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(lots);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { productId, lotNumber, expiryDate, receivedAt } = body || {};
  if (!productId || !lotNumber || !String(lotNumber).trim()) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  // quantity/manufactureDate não existem no schema StockLot atual (sem migration) — ignorados com segurança.
  try {
    const lot = await runWithTenant(tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } });
      if (!product) throw new Error('NOT_FOUND');
      const dup = await tx.stockLot.findFirst({ where: { tenantId, productId, lotNumber: String(lotNumber).trim() }, select: { id: true } });
      if (dup) throw new Error('DUPLICATE');
      return tx.stockLot.create({
        data: {
          tenantId,
          productId,
          lotNumber: String(lotNumber).trim(),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          receivedAt: receivedAt ? new Date(receivedAt) : undefined,
        },
      });
    }, { userId: getSessionUserId(session) });
    return NextResponse.json(lot, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    if (e?.message === 'DUPLICATE') return NextResponse.json({ error: 'Lote já existe para este produto' }, { status: 409 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
