import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { createInvoiceDraft, listInvoiceDrafts, InvoiceDraftServiceError } from '@/lib/invoice-draft-service';
import { validateInvoiceDraftInput } from '@/lib/invoice-draft-validation';

export async function GET() {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  return NextResponse.json({ drafts: await listInvoiceDrafts(tenantId) });
}

export async function POST(request: NextRequest) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const validation = validateInvoiceDraftInput(await request.json().catch(() => null));
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const draft = await createInvoiceDraft(validation.value, tenantId);
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof InvoiceDraftServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Erro ao guardar rascunho de factura:', error);
    return NextResponse.json({ error: 'Não foi possível guardar o rascunho.' }, { status: 500 });
  }
}
