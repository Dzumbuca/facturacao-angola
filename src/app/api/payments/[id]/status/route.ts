import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { PaymentServiceError, transitionPayment } from '@/lib/payment-service';

type Context = { params: Promise<{ id: string }> };
const allowed = new Set(['CONFIRMED', 'CANCELLED', 'REVERSED']);

export async function POST(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId, userId: actorId } = access.access;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (!body || typeof body.status !== 'string' || !allowed.has(body.status)) {
    return NextResponse.json({ error: 'Estado de pagamento inválido.' }, { status: 400 });
  }
  const { id } = await params;
  try {
    const payment = await transitionPayment(id, body.status as 'CONFIRMED' | 'CANCELLED' | 'REVERSED', tenantId, actorId);
    return NextResponse.json({ payment });
  } catch (error) {
    if (error instanceof PaymentServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Erro ao actualizar pagamento:', error);
    return NextResponse.json({ error: 'Não foi possível actualizar o pagamento.' }, { status: 500 });
  }
}
