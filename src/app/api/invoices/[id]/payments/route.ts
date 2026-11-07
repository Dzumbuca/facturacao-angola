import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';
import { PaymentServiceError, getInvoicePaymentTotals, recordPayment } from '@/lib/payment-service';
import { validatePaymentInput } from '@/lib/payment-validation';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId, userId } = access.access;
  const { id } = await params;
  const invoice = await runWithTenant(tenantId, (tx) => tx.invoice.findFirst({
    where: { id, tenantId },
    select: { id: true, number: true, payments: { orderBy: { createdAt: 'desc' }, include: { events: { orderBy: { createdAt: 'asc' } } } } },
  }), { userId }) as any;
  if (!invoice) return NextResponse.json({ error: 'Factura não encontrada.' }, { status: 404 });
  const totals = await getInvoicePaymentTotals(id, tenantId, userId);
  return NextResponse.json({ payments: invoice.payments, totals });
}

export async function POST(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId, userId: actorId } = access.access;
  const { id } = await params;
  const validation = validatePaymentInput(await request.json().catch(() => null));
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const payment = await recordPayment(id, validation.value, tenantId, actorId);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Erro ao registar pagamento:', error);
    return NextResponse.json({ error: 'Não foi possível registar o pagamento.' }, { status: 500 });
  }
}