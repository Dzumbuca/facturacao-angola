import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getInvoiceState } from '@/lib/invoice-state';
import type { InvoiceDisplayState } from '@/lib/invoice-state';

type Props = { searchParams: Promise<{ tab?: string; state?: string }> };
const stateLabel = { DRAFT: 'Rascunho', CANCELLED: 'Anulada', PAID: 'Paga', PARTIALLY_PAID: 'Parcialmente paga', OVERDUE: 'Vencida', ISSUED: 'Emitida' };
const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);

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
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-[#708195]">Documentos de venda</p><h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Facturas e rascunhos</h2><p className="mt-2 text-sm text-[#708195]">Acompanhe emissão, vencimentos e estado dos recebimentos.</p></div><Link href="/invoices/new" className="inline-flex min-h-10 items-center rounded-lg bg-[#2878d0] px-4 text-sm font-semibold text-white">Nova factura</Link></div>
    <div className="flex gap-2"><Link href="/invoices" className={`rounded-lg px-3 py-2 text-sm font-semibold ${query.tab !== 'drafts' ? 'bg-[#102b46] text-white' : 'bg-[#f0f4f8] text-[#52667a]'}`}>Emitidas ({rows.length})</Link><Link href="/invoices?tab=drafts" className={`rounded-lg px-3 py-2 text-sm font-semibold ${query.tab === 'drafts' ? 'bg-[#102b46] text-white' : 'bg-[#f0f4f8] text-[#52667a]'}`}>Rascunhos ({drafts.length})</Link></div>
    {query.tab === 'drafts' ? drafts.length ? <div className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">{(drafts as any[]).map((draft: any) => <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f5] p-4 last:border-0"><div><p className="font-semibold text-[#263c52]">{draft.customerName || 'Novo adquirente'}</p><p className="mt-1 text-xs text-[#708195]">Guardado {draft.updatedAt.toLocaleString('pt-AO')}</p></div><Link href={`/invoices/drafts/${draft.id}/edit`} className="rounded-lg border border-[#cdddeb] px-3 py-2 text-sm font-semibold text-[#2878d0]">Continuar</Link></div>)}</div> : <p className="rounded-xl bg-white p-8 text-center text-sm text-[#708195]">Não há rascunhos guardados.</p> : <div className="overflow-x-auto rounded-2xl border border-[#e2e9f1] bg-white"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-[#f7f9fc] text-xs uppercase tracking-wide text-[#708195]"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-[#edf1f5]">{filtered.map(({ invoice, state }: { invoice: any; state: InvoiceDisplayState }) => <tr key={invoice.id} className="hover:bg-[#fbfcfe]"><td className="px-4 py-3"><Link href={`/invoices/${invoice.id}`} className="font-semibold text-[#2878d0] hover:underline">{invoice.number}</Link><span className="ml-2 text-xs text-[#708195]">{invoice.type}</span></td><td className="px-4 py-3 text-[#30465c]">{invoice.customer.name}</td><td className="px-4 py-3 text-[#607286]">{invoice.issuedAt.toLocaleDateString('pt-AO')}</td><td className="px-4 py-3 text-[#607286]">{invoice.dueAt?.toLocaleDateString('pt-AO') ?? '—'}</td><td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1c2d3f]">{money(Number(invoice.total))}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state === 'OVERDUE' ? 'bg-red-50 text-red-700' : state === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#eef4fa] text-[#48627a]'}`}>{stateLabel[state]}</span></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="p-8 text-center text-sm text-[#708195]">Nenhuma factura encontrada para este filtro.</p>}</div>}
  </div>;
}
