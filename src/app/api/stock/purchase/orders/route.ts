import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orders = await runWithTenant(tenantId, async (tx: any) => {
    return tx.purchaseOrder.findMany({ where: { tenantId }, include: { supplier: true, items: true }, orderBy: { createdAt: 'desc' } });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { supplierId, items, expectedDate, warehouseId, notes } = body || {};
  // Modelo atual (sem migration): PurchaseOrder não tem warehouseId/notes. Armazém é indicado na receção.
  const unsupported: string[] = [];
  if (warehouseId !== undefined) unsupported.push('warehouseId');
  if (notes !== undefined) unsupported.push('notes');
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const order = await runWithTenant(tenantId, async (tx: any) => {
      const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId } });
      if (!supplier) throw new Error('NOT_FOUND');
      const productIds = Array.from(new Set(items.map((it: any) => it.productId).filter(Boolean))) as string[];
      if (productIds.length === 0) throw new Error('PRODUCT_NOT_FOUND');
      const found = await tx.product.findMany({ where: { tenantId, id: { in: productIds } }, select: { id: true } });
      if (found.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND');
      const total = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
      return tx.purchaseOrder.create({
        data: {
          tenantId,
          supplierId,
          status: 'PENDENTE',
          total,
          expectedAt: expectedDate ? new Date(expectedDate) : null,
          createdByUserId: getSessionUserId(session),
          items: {
            create: items.map((it: any) => ({
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice || 0),
              receivedQty: 0,
              product: { connect: { tenantId_id: { tenantId, id: it.productId } } },
            })),
          },
        },
        include: { items: true, supplier: true },
      });
    }, { userId: getSessionUserId(session) });
    return NextResponse.json({
      ...order,
      ...(unsupported.length ? {
        warnings: unsupported.map((f) => `Campo '${f}' não é suportado pelo modelo atual de encomenda (sem migration); não foi persistido.`),
        warehouseNote: 'O armazém de destino é indicado no momento da receção da encomenda (POST /api/stock/purchase/receptions, campo warehouseId obrigatório).',
      } : {}),
    }, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
    if (e?.message === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    console.error('PO_CREATE_ERROR:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
