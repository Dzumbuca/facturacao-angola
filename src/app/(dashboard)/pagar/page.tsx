import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { PayableActions } from './payable-actions';

const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
const stateLabels: Record<string, string> = { PENDING: 'Pendente', PAID: 'Paga', OVERDUE: 'Vencida', CANCELLED: 'Cancelada' };

export default async function PagarPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const invoices = await prisma.supplierInvoice.findMany({
    where: { tenantId, status: { in: ['PENDING', 'OVERDUE'] } },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { issuedAt: 'asc' }],
    include: { supplier: { select: { id: true, name: true, nif: true } }, purchaseOrder: { select: { id: true, status: true } } },
  });

  const outstandingByInvoice = invoices.map((inv: any) => ({
    ...inv,
    outstanding: Math.max(0, Number(inv.total) - Number(inv.paidAmount)),
  }));

  const overdue = outstandingByInvoice.filter((inv: any) => inv.dueDate && inv.dueDate < new Date());
  const totalOutstanding = outstandingByInvoice.reduce((sum: number, inv: any) => sum + inv.outstanding, 0);
  const totalOverdue = overdue.reduce((sum: number, inv: any) => sum + inv.outstanding, 0);

  return <div className="space-y-8 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-[#708195]">Compras</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Contas a pagar</h2>
        <p className="mt-2 text-sm text-[#708195]">Acompanha as facturas dos fornecedores ainda pendentes.
          Regista pagamentos e verifica o estado de cada obrigação.</p>
      </div>
      <Link href="/stock/compras/faturas/new" className="inline-flex h-11 items-center rounded-xl bg-[#021f87] px-5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(2,31,135,.28)] transition hover:bg-[#011566]">
        Registar factura de fornecedor
      </Link>
    </div>

    <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Em dívida</p>
        <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#1c2d3f]">{money(totalOutstanding)}</p>
        <p className="mt-1 text-xs text-[#708195]">{outstandingByInvoice.length} fatura{outstandingByInvoice.length === 1 ? '' : 's'}</p>
      </div>
      <div className="rounded-2xl border border-[#fbe2cf] bg-white p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#a83939]">Vencidas</p>
        <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#a83939]">{money(totalOverdue)}</p>
        <p className="mt-1 text-xs text-[#708195]">{overdue.length} fatura{overdue.length === 1 ? '' : 's'} em atraso</p>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
      <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6">
        <h3 className="font-bold text-[#1c2d3f]">Facturas de fornecedor pendentes</h3>
        <p className="mt-1 text-xs text-[#708195]">Cancela as que não se aplicam e regista os pagamentos.</p>
      </div>
      {outstandingByInvoice.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[#708195]">
          <p>Sem obrigações pendentes com fornecedores. Clique em <strong>Registar factura de fornecedor</strong> acima para iniciar o fluxo.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#edf1f5]">
          {outstandingByInvoice.map((invoice: any) => {
            const overdueNow = invoice.dueDate && invoice.dueDate < new Date() && Number(invoice.paidAmount) < Number(invoice.total);
            return (
              <li key={invoice.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="tabular-nums text-base text-[#1c2d3f]">{invoice.number}</strong>
                    <span className={`rounded-full bg-[#f0f4f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.10em] ${overdueNow ? 'text-[#a83939]' : 'text-[#2878d0]'}`}>
                      {overdueNow ? 'Vencida' : stateLabels[invoice.status] ?? invoice.status}
                    </span>
                    {invoice.purchaseOrderId && <span className="text-[10px] text-[#708195]">· PO vinculado</span>}
                  </div>
                  <p className="truncate text-sm font-semibold text-[#1c2d3f]">{invoice.supplier?.name}</p>
                  <p className="text-xs text-[#627068]">
                    Emitida {invoice.issuedAt.toISOString().slice(0, 10)}
                    {invoice.dueDate && ` · vence ${invoice.dueDate.toISOString().slice(0, 10)}`}
                    {invoice.supplier?.nif && ` · NIF ${invoice.supplier.nif}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 md:flex-col md:items-end">
                  <div className="text-right">
                    <p className="tabular-nums text-lg font-extrabold text-[#1c2d3f]">{money(invoice.outstanding)}</p>
                    <p className="text-[10px] text-[#708195]">de {money(Number(invoice.total))}</p>
                  </div>
                  <PayableActions invoiceId={invoice.id} outstanding={invoice.outstanding} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  </div>;
}
