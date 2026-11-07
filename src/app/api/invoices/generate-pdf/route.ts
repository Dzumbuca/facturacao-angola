import { NextRequest, NextResponse } from 'next/server';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { validateInvoiceWithAgent } from '@/lib/agent-service';
import { issueInvoice } from '@/lib/invoice-service';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { getInvoiceServerErrorMessage } from '@/lib/invoice-api-error';
import { getInvoiceQuota, quotaBlocked, quotaMessage, InvoiceQuotaExceededError } from '@/lib/invoice-quota';

export async function POST(req: NextRequest) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;

    const quota = await getInvoiceQuota(tenantId, userId);
    if (quotaBlocked(quota)) {
      return NextResponse.json({ error: quotaMessage(quota), reason: 'INVOICE_QUOTA_EXCEEDED', used: quota.used, limit: quota.limit, upgrade: true }, { status: 402 });
    }

    const data = await req.json();
    const compliance = await validateInvoiceWithAgent(data);
    if (!compliance.isValid) {
      return NextResponse.json({ error: 'Fatura inválida', warnings: compliance.warnings }, { status: 400 });
    }

    let pdfBuffer: Buffer | undefined;
    const finalizedInvoice = await issueInvoice(data, tenantId, async (draft) => {
      pdfBuffer = await generateInvoicePDF(draft);
    });
    if (!pdfBuffer) throw new Error('O PDF não foi gerado.');

    const response = new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="fatura_selada_' + finalizedInvoice.hash.substring(0,8) + '.pdf"',
        'X-Invoice-Id': finalizedInvoice.id,
        'X-Invoice-Number': finalizedInvoice.number ?? '',
      },
    });
    return response;
  } catch (error) {
    if (error instanceof InvoiceQuotaExceededError) {
      return NextResponse.json({ error: error.message, reason: 'INVOICE_QUOTA_EXCEEDED', used: error.used, limit: error.limit, upgrade: true }, { status: 402 });
    }
    console.error('Erro ao emitir fatura:', error);
    const message = getInvoiceServerErrorMessage(error);
    return NextResponse.json({ error: message }, { status: message.startsWith('A base de dados') ? 503 : 500 });
  }
}