import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { sendAndRecordEmail } from '@/lib/email-actions';

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const recipient = typeof (body as any)?.recipient === 'string' ? (body as any).recipient.trim() : '';
  if (recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return NextResponse.json({ error: 'Introduza um email válido.' }, { status: 400 });
  const invoice = await prisma.invoice.findFirst({ where: { id: (await params).id, tenantId: access.access.tenantId }, include: { customer: true, tenant: true, items: true, companyLogo: true, payments: { orderBy: { paymentDate: 'asc' } } } });
  if (!invoice) return NextResponse.json({ error: 'Factura não encontrada.' }, { status: 404 });
  if (invoice.status !== 'ISSUED' || invoice.type !== 'FT') return NextResponse.json({ error: 'Só é possível enviar uma factura emitida.' }, { status: 409 });
  const storedRecipient = invoice.customer.email?.trim() ?? '';
  if (!storedRecipient || storedRecipient.toLowerCase() !== recipient.toLowerCase()) return NextResponse.json({ error: 'O destinatário deve corresponder ao email guardado no cadastro do cliente.' }, { status: 400 });
  try {
    const pdf = await generateInvoicePDF({ ...invoice, customer: invoice.customer, customerName: invoice.customer.name, customerNif: invoice.customer.nif, customerEmail: invoice.customer.email, createdAt: invoice.issuedAt, items: invoice.items.map((item: any) => ({ desc: item.description, qty: Number(item.quantity), rate: Number(item.unitPrice), total: Number(item.total), taxRate: Number(item.taxRate) })) });
    const result = await sendAndRecordEmail({
      purpose: 'INVOICE', to: storedRecipient, subject: `Factura ${invoice.number} — ${invoice.tenant.name}`,
      text: `Segue em anexo a factura ${invoice.number} emitida por ${invoice.tenant.name}.`,
      html: `<p>Segue em anexo a factura <strong>${invoice.number.replace(/[&<>"']/g, '')}</strong> emitida por ${invoice.tenant.name.replace(/[&<>"']/g, '')}.</p>`,
      tenantId: invoice.tenantId, invoiceId: invoice.id, sentByUserId: access.access.userId,
      attachments: [{ filename: `${invoice.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
    if (!result.ok || !result.accepted) return NextResponse.json({ error: 'O servidor de email não aceitou o envio. A factura não foi marcada como enviada; pode tentar novamente.' }, { status: 502 });
    return NextResponse.json({ success: true, message: 'O servidor de email aceitou a mensagem. Isto não confirma a entrega na caixa de entrada.' });
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar ou enviar a factura.' }, { status: 500 });
  }
}
