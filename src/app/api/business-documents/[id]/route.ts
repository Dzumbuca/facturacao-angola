import { NextRequest, NextResponse } from 'next/server';
import { createBusinessDocumentService } from '@/lib/business-document-service';
import { businessDocumentRepository } from '@/lib/business-document-repository';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';

const service = createBusinessDocumentService(businessDocumentRepository);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const document = await service.get(id, access.access);
  return document
    ? NextResponse.json({ document }, { headers: { 'Cache-Control': 'private, no-store' } })
    : NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const result = await service.updateDraft(id, await request.json().catch(() => null), access.access);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ document: result.value }, { headers: { 'Cache-Control': 'private, no-store' } });
}
