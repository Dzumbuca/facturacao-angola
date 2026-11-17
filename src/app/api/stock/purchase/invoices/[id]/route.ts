import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';
import { recordSupplierInvoicePayment, cancelSupplierInvoice } from '@/lib/supplier-invoice-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const { id } = await params;
  const invoice = await runWithTenant(tenantId, (tx) => tx.supplierInvoice.findFirst({
    where: { id, tenantId },
    include: { supplier: true, purchaseOrder: { select: { id: true, status: true, total: true } } },
  }));
  if (!invoice) return NextResponse.json({ error: 'Factura de fornecedor não encontrada.' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId, userId } = access.access;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : '';

  try {
    if (action === 'payment') {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'amount deve ser um número positivo.' }, { status: 400 });
      }
      const invoice = await recordSupplierInvoicePayment(id, amount, tenantId, userId);
      return NextResponse.json(invoice);
    }
    if (action === 'cancel') {
      const invoice = await cancelSupplierInvoice(id, tenantId);
      return NextResponse.json(invoice);
    }
    return NextResponse.json({ error: 'action inválida (use "payment" ou "cancel").' }, { status: 400 });
  } catch (error: any) {
    const code = error?.message === 'INVOICE_FINAL' ? 409 : (error?.message === 'SUPPLIER_INVOICE_NOT_FOUND' ? 404 : 500);
    return NextResponse.json({ error: error?.message ?? 'Erro interno.' }, { status: code });
  }
}
