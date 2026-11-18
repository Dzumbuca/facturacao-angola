import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getInvoiceState } from '@/lib/invoice-state';
import { ReceivableActions } from './receivable-actions';

const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
const stateLabels: Record<string, string> = { DRAFT: 'Rascunho', ISSUED: 'Emitida', PAID: 'Paga', PARTIALLY_PAID: 'Parc. paga', OVERDUE: 'Vencida', CANCELLED: 'Anulada' };
const stateStyles: Record<string, string> = {
  PAID: 'text-[#227958]',
  PARTIALLY_PAID: 'text-[#8a5a10]',
  OVERDUE: 'text-[#a83939]',
  ISSUED: 'text-[#2878d0]',
  CANCELLED: 'text-slate-600',
};

export default async function RecebiveisPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const [pending, invoices] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        invoice: { select: { id: true, number: true, customer: { select: { name: true } } } },
      },
    }),
    prisma.invoice.findMany({
      where: { tenantId, type: 'FT', status: 'ISSUED' },
      orderBy: [{ dueAt: 'asc' }, { issuedAt: 'asc' }],
      include: {
        customer: { select: { id: true, name: true } },
        payments: { select: { amount: true, status: true } },
      },
    }),
  ]);

  const outstanding = invoices
    .map((invoice: any): { invoice: any; state: string; confirmed: number; outstanding: number } => {
      const confirmed = invoice.payments
        .filter((payment: any) => payment.status === 'CONFIRMED')
        .reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
      const state = getInvoiceState(invoice, confirmed);
      const outstandingAmount = Math.max(0, Number(invoice.total) - confirmed);
      return { invoice, state, confirmed, outstanding: outstandingAmount };
    })
    .filter((row: { state: string; outstanding: number }) => row.state !== 'PAID' && row.state !== 'CANCELLED' && row.outstanding > 0);

  const outstandingTotal = outstanding.reduce((sum: number, item: { outstanding: number }) => sum + item.outstanding, 0);
  const overdueRows = outstanding.filter((row: { state: string; outstanding: number }) => row.state === 'OVERDUE');
  const pendingRows = outstanding.filter((row: { state: string; outstanding: number }) => row.state !== 'OVERDUE');
  const overdueTotal = overdueRows.reduce((sum: number, row: { outstanding: number }) => sum + row.outstanding, 0);

  return <div className="space-y-8 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-[#708195]">Financeiro</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Recebimentos</h2>
        <p className="mt-2 text-sm text-[#708195]">Confirma recebimentos reportados e acompanha os valores por cobrar.</p>
      </div>
      <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-[#cddeef] bg-[#f7fbff] px-4 py-2 text-sm">
          <span className="text-[#708195]">Em dívida:</span>
          <strong className="tabular-nums text-lg text-[#1c2d3f]">{money(outstandingTotal)}</strong>
          <span className="text-xs text-[#708195]">{outstanding.length} factura{outstanding.length === 1 ? '' : 's'}</span>
        </div>
        {overdueRows.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#fbe2cf] bg-[#fdf4f0] px-4 py-2 text-sm">
            <span className="text-[#a83939]">Vencidas:</span>
            <strong className="tabular-nums text-lg text-[#a83939]">{money(overdueTotal)}</strong>
            <span className="text-xs text-[#a83939]">{overdueRows.length} factura{overdueRows.length === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>
    </div>

    <section className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
      <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6">
        <h3 className="font-bold text-[#1c2d3f]">A aguardar confirmação</h3>
        <p className="mt-1 text-xs text-[#708195]">Pagamentos reportados pela empresa ou pelo cliente — confirma ou rejeita, com comprovativo anexado quando houver.</p>
      </div>
      {pending.length ? (
        <ul className="divide-y divide-[#edf1f5]">
          {pending.map((payment: any) => {
            const reportedByClient = !payment.createdByUserId;
            return (
              <li key={payment.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/invoices/${payment.invoice.id}`} className="text-sm font-bold text-[#1c2d3f] underline-offset-2 hover:underline">{payment.invoice.number}</Link>
                    <span className="rounded-full bg-[#eef4fa] px-2 py-0.5 text-[10px] font-bold uppercase text-[#48627a]">{payment.method}</span>
                    {reportedByClient && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Cliente</span>}
                  </div>
                  <p className="truncate text-sm font-semibold text-[#263c52]">{payment.invoice.customer.name}</p>
                  <p className="text-sm font-bold tabular-nums text-[#227958]">{money(Number(payment.amount))}</p>
                </div>
                <ReceivableActions
                  paymentId={payment.id}
                  hasProof={Boolean(payment.proofData)}
                  reportedByClient={reportedByClient}
                  reference={payment.reference}
                  notes={payment.notes}
                  method={payment.method}
                  paymentDate={payment.paymentDate.toISOString()}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-6 py-10 text-center text-sm text-[#708195]">Nenhum recebimento pendente neste momento.</p>
      )}
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#fbe2cf] bg-white">
      <div className="border-b border-[#fbdec8] bg-[#fdf6ef] px-5 py-4 md:px-6">
        <h3 className="font-bold text-[#a83939]">Vencidas (acção urgente)</h3>
        <p className="mt-1 text-xs text-[#a83939]">Facturas cujo vencimento já passou — clica numa factura para confirmar o recebimento ou contactar o cliente.</p>
      </div>
      {overdueRows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-[#fbe2cf] text-xs uppercase tracking-wide text-[#a83939]">
              <tr><th className="px-4 py-3">Factura</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Recebido</th><th className="px-4 py-3 text-right">Em dívida</th><th className="px-4 py-3 text-right">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-[#f1d9c8]">
              {overdueRows.map(({ invoice, state, confirmed, outstanding }: { invoice: any; state: string; confirmed: number; outstanding: number }) => (
                <tr key={invoice.id} className="hover:bg-[#fdf6ef]">
                  <td className="px-4 py-3"><Link href={`/invoices/${invoice.id}`} className="font-bold text-[#2878d0] underline-offset-2 hover:underline">{invoice.number}</Link></td>
                  <td className="px-4 py-3 text-[#263c52]">{invoice.customer.name}</td>
                  <td className="px-4 py-3 font-semibold text-[#a83939]">{invoice.dueAt?.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' }) ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(Number(invoice.total))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#227958]">{money(confirmed)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{money(outstanding)}</td>
                  <td className={`px-4 py-3 text-right text-xs font-bold uppercase ${stateStyles[state] ?? ''}`}>{stateLabels[state] ?? state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-6 py-8 text-center text-sm text-[#708195]">Sem facturas vencidas. Bom trabalho.</p>
      )}
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
      <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6">
        <h3 className="font-bold text-[#1c2d3f]">Pendentes (ainda dentro do prazo)</h3>
        <p className="mt-1 text-xs text-[#708195]">Facturas emitidas com saldo em aberto, mas ainda dentro do prazo de vencimento — clica numa factura para confirmar o recebimento no detalhe.</p>
      </div>
      {pendingRows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-[#f7f9fc] text-xs uppercase tracking-wide text-[#708195]">
              <tr><th className="px-4 py-3">Factura</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Recebido</th><th className="px-4 py-3 text-right">Em dívida</th><th className="px-4 py-3 text-right">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {pendingRows.map(({ invoice, state, confirmed, outstanding }: { invoice: any; state: string; confirmed: number; outstanding: number }) => (
                <tr key={invoice.id} className="hover:bg-[#f8fbff]">
                  <td className="px-4 py-3"><Link href={`/invoices/${invoice.id}`} className="font-bold text-[#2878d0] underline-offset-2 hover:underline">{invoice.number}</Link></td>
                  <td className="px-4 py-3 text-[#263c52]">{invoice.customer.name}</td>
                  <td className="px-4 py-3 text-[#5b6f85]">{invoice.dueAt?.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' }) ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(Number(invoice.total))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#227958]">{money(confirmed)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{money(outstanding)}</td>
                  <td className={`px-4 py-3 text-right text-xs font-bold uppercase ${stateStyles[state] ?? ''}`}>{stateLabels[state] ?? state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-6 py-10 text-center text-sm text-[#708195]">Não há saldos em aberto neste momento. Bom trabalho.</p>
      )}
    </section>
  </div>;
}
