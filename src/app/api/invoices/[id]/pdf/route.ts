import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { generateInvoicePDF } from '@/lib/pdf-generator';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const invoice = await prisma.invoice.findFirst({
    where: { id: (await params).id, tenantId },
    include: {
      customer: true,
      items: true,
      companyLogo: true,
      payments: { orderBy: { paymentDate: 'asc' } },
    },
  });
  if (!invoice) return NextResponse.json({ error: 'Factura não encontrada.' }, { status: 404 });
  try {
    const pdf = await generateInvoicePDF({
      ...invoice,
      customerName: invoice.customer.name,
      customerNif: invoice.customer.nif,
      customer: invoice.customer,
      createdAt: invoice.issuedAt,
      items: invoice.items.map((item: any) => ({
        desc: item.description,
        qty: Number(item.quantity),
        rate: Number(item.unitPrice),
        total: Number(item.total),
        taxRate: Number(item.taxRate),
      })),
    });
    return new NextResponse(pdf as any, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${invoice.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"` } });
  } catch (error) {
    console.error('Erro ao reconstruir PDF da factura:', error);
    return NextResponse.json({ error: 'Não foi possível gerar o PDF.' }, { status: 500 });
  }
}
