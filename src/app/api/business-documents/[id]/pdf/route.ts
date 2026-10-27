import { NextResponse } from 'next/server';
import { getTenantReadAccess } from '@/lib/tenant-api-access';
import { createBusinessDocumentService } from '@/lib/business-document-service';
import { businessDocumentRepository } from '@/lib/business-document-repository';
import { generateBusinessDocumentRecordPDF } from '@/lib/business-document-pdf';
import { prisma } from '@/lib/prisma';

const service = createBusinessDocumentService(businessDocumentRepository);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const document = await service.get(id, access.access);
  if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  let logo: { mimeType: string; content: Uint8Array } | null = null;
  const logoId = (document.companySnapshot as Record<string, unknown>)?.currentLogoId;
  if (typeof logoId === 'string') {
    const storedLogo = await prisma.companyLogo.findFirst({ where: { id: logoId, tenantId: access.access.tenantId }, select: { mimeType: true, content: true } });
    if (storedLogo) logo = { mimeType: storedLogo.mimeType, content: storedLogo.content };
  }
  const pdf = await generateBusinessDocumentRecordPDF(document as any, logo);
  const safeNumber = String(document.number).replace(/[^A-Za-z0-9._-]/g, '_');
  return new NextResponse(new Uint8Array(pdf), { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${safeNumber}.pdf"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
