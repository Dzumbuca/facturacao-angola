import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getInvoiceState } from '@/lib/invoice-state';
import { PaymentPanel } from './payment-panel';
import { SendInvoiceEmail } from './send-invoice-email';

type Props = { params: Promise<{ id: string }> };
const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
const states = { DRAFT: 'Rascunho', CANCELLED: 'Anulada', PAID: 'Paga', PARTIALLY_PAID: 'Parcialmente paga', OVERDUE: 'Vencida', ISSUED: 'Emitida' };

export default async function InvoiceDetailPage({ params }: Props) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId }, include: { customer: true, items: true, tenant: { select: { defaultPaymentMethod: true } }, payments: { orderBy: { createdAt: 'desc' }, include: { events: { orderBy: { createdAt: 'asc' } } } } } });
  if (!invoice) notFound();
  const confirmed = invoice.payments.filter((payment: any) => payment.status === 'CONFIRMED').reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
  const state = getInvoiceState(invoice, confirmed);
  const paymentList = invoice.payments.map((payment: any) => ({ id: payment.id, amount: Number(payment.amount), method: payment.method, status: payment.status, paymentDate: payment.paymentDate.toISOString(), reference: payment.reference, notes: payment.notes, events: payment.events.map((event: any) => ({ ...event, createdAt: event.createdAt.toISOString() })) }));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/invoices" className="text-sm font-semibold text-[#2878d0]">← Facturas</Link><h2 className="mt-2 text-2xl font-bold text-[#1c2d3f]">{invoice.number}</h2><p className="mt-1 text-sm text-[#708195]">{invoice.type} · {invoice.customer.name} · {states[state]}</p></div><a href={`/api/invoices/${invoice.id}/pdf`} className="inline-flex min-h-10 items-center rounded-lg border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#2878d0]">Descarregar PDF</a></div>
    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 md:p-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-[#708195]">Adquirente</p><p className="mt-1 font-semibold text-[#263c52]">{invoice.customer.name}</p><p className="text-xs text-[#708195]">{invoice.customer.nif ? `NIF ${invoice.customer.nif}` : 'Sem NIF'}</p></div><div><p className="text-xs text-[#708195]">Emissão</p><p className="mt-1 font-semibold text-[#263c52]">{invoice.issuedAt.toLocaleDateString('pt-AO')}</p></div><div><p className="text-xs text-[#708195]">Vencimento</p><p className="mt-1 font-semibold text-[#263c52]">{invoice.dueAt?.toLocaleDateString('pt-AO') ?? 'Não indicado'}</p></div><div><p className="text-xs text-[#708195]">Total</p><p className="mt-1 tabular-nums text-xl font-bold text-[#1c2d3f]">{money(Number(invoice.total))}</p></div></div></section>
    <section className="overflow-x-auto rounded-2xl border border-[#e2e9f1] bg-white"><table className="min-w-[620px] w-full text-left text-sm"><thead className="bg-[#f7f9fc] text-xs uppercase tracking-wide text-[#708195]"><tr><th className="px-4 py-3">Artigo</th><th className="px-4 py-3 text-right">Quantidade</th><th className="px-4 py-3 text-right">Preço unitário</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-[#edf1f5]">{invoice.items.map((item: any) => <tr key={item.id}><td className="px-4 py-3 font-medium text-[#263c52]">{item.description}</td><td className="px-4 py-3 text-right tabular-nums">{Number(item.quantity)}</td><td className="px-4 py-3 text-right tabular-nums">{money(Number(item.unitPrice))}</td><td className="px-4 py-3 text-right tabular-nums font-semibold">{money(Number(item.total))}</td></tr>)}</tbody></table><div className="space-y-2 border-t border-[#edf1f5] p-4 text-right text-sm"><p className="text-[#607286]">Subtotal: {money(Number(invoice.subTotal))}</p>{Number(invoice.discountAmount) > 0 && <p className="text-[#607286]">Desconto: −{money(Number(invoice.discountAmount))}</p>}<p className="text-[#607286]">IVA: {money(Number(invoice.taxTotal))}</p><p className="text-base font-bold text-[#1c2d3f]">Total: {money(Number(invoice.total))}</p></div>{invoice.observations && <p className="border-t border-[#edf1f5] px-4 py-3 text-sm text-[#607286]"><strong>Observações:</strong> {invoice.observations}</p>}</section>
    {invoice.type === 'FT' && invoice.status === 'ISSUED' && <PaymentPanel invoiceId={invoice.id} invoiceStatus={invoice.status} total={Number(invoice.total)} initialPayments={paymentList} defaultMethod={invoice.tenant.defaultPaymentMethod ?? undefined} />}
    {invoice.type === 'FT' && invoice.status === 'ISSUED' && <SendInvoiceEmail invoiceId={invoice.id} customerEmail={invoice.customer.email} />}
  </div>;
}
