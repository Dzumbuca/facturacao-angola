import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { registerStockEntry } from '@/lib/stock-service';

export async function POST(req: NextRequest) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });

  const { productId, quantity, reason, reference } = body;

  if (!productId || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Produto e quantidade valida sao obrigatorios.' }, { status: 400 });
  }

  try {
    const result = await registerStockEntry(
      tenantId,
      productId,
      quantity,
      reason || 'Entrada por compra/fornecedor',
      reference || `PURCH-${crypto.randomUUID()}`,
      (body as any).createdByUserId
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao registrar entrada de estoque.' }, { status: 400 });
  }
}
