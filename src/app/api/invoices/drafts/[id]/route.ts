import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { getInvoiceDraft, updateInvoiceDraft, InvoiceDraftServiceError } from '@/lib/invoice-draft-service';
import { validateInvoiceDraftInput } from '@/lib/invoice-draft-validation';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  try {
    return NextResponse.json({ draft: await getInvoiceDraft((await params).id, tenantId) });
  } catch (error) {
    if (error instanceof InvoiceDraftServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Não foi possível carregar o rascunho.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const body = await request.json().catch(() => null);
  if (body?.expectedUpdatedAt !== undefined && (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))) {
    return NextResponse.json({ error: 'Versão do rascunho inválida.' }, { status: 400 });
  }
  const validation = validateInvoiceDraftInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const draft = await updateInvoiceDraft((await params).id, validation.value, tenantId, body?.expectedUpdatedAt ? new Date(body.expectedUpdatedAt) : undefined);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof InvoiceDraftServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Não foi possível actualizar o rascunho.' }, { status: 500 });
  }
}
