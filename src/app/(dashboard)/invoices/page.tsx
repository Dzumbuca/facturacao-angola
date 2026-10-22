import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getInvoiceState } from '@/lib/invoice-state';
import type { InvoiceDisplayState } from '@/lib/invoice-state';
import { InvoicesTabs } from './invoices-tabs';

type Props = { searchParams: Promise<{ state?: string }> };

export default async function InvoicesPage({ searchParams }: Props) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const query = await searchParams;
  const [invoices, drafts] = await Promise.all([
    prisma.invoice.findMany({ where: { tenantId }, orderBy: { issuedAt: 'desc' }, take: 250, include: { customer: true, payments: { select: { amount: true, status: true } } } }),
    prisma.invoiceDraft.findMany({ where: { tenantId, status: 'DRAFT' }, orderBy: { updatedAt: 'desc' } }),
  ]);
  const rows: { invoice: any; state: InvoiceDisplayState }[] = (invoices as any[]).map((invoice: any) => ({ invoice, state: getInvoiceState(invoice, invoice.payments.filter((payment: any) => payment.status === 'CONFIRMED').reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)) }));
  const filtered = query.state ? rows.filter((row: { state: InvoiceDisplayState }) => row.state === query.state) : rows;

  const issuedRows = filtered.map(({ invoice, state }: { invoice: any; state: InvoiceDisplayState }) => ({
    id: invoice.id as string,
    number: invoice.number as string,
    type: invoice.type as string,
    customerName: invoice.customer.name as string,
    issuedAtISO: invoice.issuedAt.toISOString() as string,
    dueAtISO: invoice.dueAt ? invoice.dueAt.toISOString() as string : null,
    total: Number(invoice.total),
    state,
  }));
  const draftRows = (drafts as any[]).map((draft: any) => ({
    id: draft.id as string,
    customerName: (draft.customerName || 'Novo adquirente') as string,
    updatedAtISO: draft.updatedAt.toISOString() as string,
  }));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-[#708195]">Documentos de venda</p><h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Facturas e rascunhos</h2><p className="mt-2 text-sm text-[#708195]">Acompanhe emissão, vencimentos e estado dos recebimentos.</p></div><Link href="/invoices/new" className="inline-flex min-h-10 items-center rounded-lg bg-[#2878d0] px-4 text-sm font-semibold text-white">Nova factura</Link></div>
    <InvoicesTabs issuedRows={issuedRows} draftRows={draftRows} />
  </div>;
}
