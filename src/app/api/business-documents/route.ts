import { NextRequest, NextResponse } from 'next/server';
import { BUSINESS_DOCUMENT_TYPES, type BusinessDocumentStatus } from '@/lib/business-document-core';
import { createBusinessDocumentService } from '@/lib/business-document-service';
import { businessDocumentRepository } from '@/lib/business-document-repository';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';

const service = createBusinessDocumentService(businessDocumentRepository);
const STATUSES: BusinessDocumentStatus[] = ['DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CONVERTED'];
const realDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime()) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export async function GET(request: NextRequest) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const params = request.nextUrl.searchParams;
  const page = Number(params.get('page') ?? '1');
  const type = params.get('type') ?? undefined;
  const status = params.get('status') ?? undefined;
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return NextResponse.json({ error: 'Página inválida.' }, { status: 400 });
  if (type && !BUSINESS_DOCUMENT_TYPES.includes(type as any)) return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 });
  if (status && !STATUSES.includes(status as BusinessDocumentStatus)) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
  if ((from && !realDate(from)) || (to && !realDate(to)) || (from && to && from > to)) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 });
  const result = await service.list({
    tenantId: access.access.tenantId, page, pageSize: 20,
    query: (params.get('q') ?? '').trim().slice(0, 120) || undefined,
    type: type as any, status: status as BusinessDocumentStatus | undefined,
    from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
  });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const result = await service.create(await request.json().catch(() => null), access.access);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ document: result.value }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
}
