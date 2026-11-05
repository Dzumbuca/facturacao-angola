import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { registerStockEntry } from '@/lib/stock-service';

export async function POST(req: NextRequest) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId, userId } = access.access;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });

  const { productId, quantity, reason, reference, warehouseId } = body;

  if (!productId || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Produto e quantidade valida sao obrigatorios.' }, { status: 400 });
  }
  if (!warehouseId) {
    return NextResponse.json({ error: 'Armazem e obrigatorio.' }, { status: 400 });
  }

  try {
    const result = await registerStockEntry(
      tenantId,
      productId,
      warehouseId,
      quantity,
      reason || 'Entrada por compra/fornecedor',
      reference || `PURCH-${crypto.randomUUID()}`,
      userId,
      userId
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao registrar entrada de estoque.' }, { status: 400 });
  }
}