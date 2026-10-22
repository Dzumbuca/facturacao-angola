import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { issueInvoiceDraft, InvoiceDraftServiceError } from '@/lib/invoice-draft-service';
import { getInvoiceQuota, quotaExceeded, quotaUpgradeMessage } from '@/lib/invoice-quota';

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;

  const quota = await getInvoiceQuota(tenantId);
  if (quotaExceeded(quota)) {
    return NextResponse.json({ error: quotaUpgradeMessage(quota), upgrade: true }, { status: 402 });
  }
  try {
    let pdf: Buffer | undefined;
    const invoice = await issueInvoiceDraft((await params).id, tenantId, async (document) => { pdf = await generateInvoicePDF(document); });
    if (!pdf) throw new Error('O PDF não foi gerado.');
    return new NextResponse(pdf as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof InvoiceDraftServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Erro ao emitir factura a partir do rascunho:', error);
    return NextResponse.json({ error: 'Não foi possível emitir a factura.' }, { status: 500 });
  }
}
