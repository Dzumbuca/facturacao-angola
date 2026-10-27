import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { createBusinessDocumentService } from '@/lib/business-document-service';
import { businessDocumentRepository } from '@/lib/business-document-repository';
import type { BusinessDocumentStatus } from '@/lib/business-document-core';

const service = createBusinessDocumentService(businessDocumentRepository);
const statuses: BusinessDocumentStatus[] = ['ISSUED', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const body = await request.json().catch(() => null);
  const target = body && typeof body === 'object' ? (body as Record<string, unknown>).status : null;
  if (typeof target !== 'string' || !statuses.includes(target as BusinessDocumentStatus)) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
  const result = await service.transition(id, target as BusinessDocumentStatus, access.access);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ document: result.value }, { headers: { 'Cache-Control': 'private, no-store' } });
}
