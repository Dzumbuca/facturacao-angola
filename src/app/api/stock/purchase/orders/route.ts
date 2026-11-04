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
  }, { userId: getSessionUserId(session), isAdmin: false });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { supplierId, warehouseId, items, notes, expectedDate } = body;
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  try {
    const order = await runWithTenant(tenantId, async (tx: any) => {
      const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId } });
      if (!supplier) throw new Error('NOT_FOUND');
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
              tenantId,
              productId: it.productId,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice || 0),
              receivedQty: 0,
            })),
          },
        },
        include: { items: true, supplier: true },
      });
    }, { userId: getSessionUserId(session), isAdmin: false });
    return NextResponse.json(order, { status: 201 });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
    console.error('PO_CREATE_ERROR:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
