import { NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { createBusinessDocumentService } from '@/lib/business-document-service';
import { businessDocumentRepository } from '@/lib/business-document-repository';

const service = createBusinessDocumentService(businessDocumentRepository);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  try {
    const result = await service.convertToInvoiceDraft(id, access.access);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ draftId: result.value.draftId }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Este documento já tem um rascunho de factura associado.' }, { status: 409 });
    }
    console.error('Erro ao converter documento empresarial:', error);
    return NextResponse.json({ error: 'Não foi possível criar o rascunho de factura.' }, { status: 500 });
  }
}
