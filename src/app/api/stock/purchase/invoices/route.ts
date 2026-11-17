import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { createSupplierInvoice, getOutstandingSupplierInvoices } from '@/lib/supplier-invoice-service';

export async function GET(_req: NextRequest) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const { invoices, total } = await getOutstandingSupplierInvoices(tenantId);
  return NextResponse.json({ invoices, total });
}

export async function POST(req: NextRequest) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const body = await req.json().catch(() => ({}));
  const { supplierId, number, total, taxTotal, issuedAt, dueDate, purchaseOrderId, notes } = body || {};

  if (!supplierId || !number || !Number.isFinite(Number(total))) {
    return NextResponse.json({ error: 'supplierId, number e total são obrigatórios.' }, { status: 400 });
  }

  try {
    const invoice = await createSupplierInvoice({
      supplierId,
      number,
      total: Number(total),
      taxTotal: Number(taxTotal ?? 0),
      issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      purchaseOrderId: purchaseOrderId ?? null,
      notes: typeof notes === 'string' ? notes : null,
    }, tenantId);
    return NextResponse.json(invoice, { status: 201 });
  } catch (error: any) {
    const code = error?.message === 'SUPPLIER_NOT_FOUND' ? 404 : 500;
    console.error('SupplierInvoice_CREATE_ERROR:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro interno.' }, { status: code });
  }
}
