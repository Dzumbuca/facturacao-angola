import Link from 'next/link';
import { getInvoiceState } from '@/lib/invoice-state';
import type { InvoiceDisplayState } from '@/lib/invoice-state';

type RecentInvoice = {
  id: string;
  number?: string | null;
  type: string;
  status: string;
  total: number | string;
  issuedAt: Date;
  dueAt: Date | null;
  payments: { amount: number | string; status: string }[];
  customer?: { name: string } | null;
};

const money = (value: number) =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(value);
const dateOnly = (date: Date) =>
  new Intl.DateTimeFormat('pt-AO', { timeZone: 'Africa/Luanda', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);

const stateLabel: Record<InvoiceDisplayState, string> = {
  DRAFT: 'Rascunho',
  CANCELLED: 'Anulada',
  PAID: 'Paga',
  PARTIALLY_PAID: 'Parcial',
  OVERDUE: 'Vencida',
  ISSUED: 'Emitida',
};

const stateColors: Record<InvoiceDisplayState, string> = {
  DRAFT: '#8494a9',
  CANCELLED: '#bb4848',
  PAID: '#248468',
  PARTIALLY_PAID: '#b16d15',
  OVERDUE: '#bb4848',
  ISSUED: '#748397',
};

export function ActivityTable({ invoices }: { invoices: RecentInvoice[] }) {
  const rows = invoices.slice(0, 4);

  return (
    <section aria-labelledby="activity-heading" className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p id="activity-heading" className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Actividade</p>
          <h2 className="mt-1 text-[var(--text)] text-[20px] font-extrabold tracking-tight">Actividade recente</h2>
        </div>
        <Link href="/invoices" className="text-sm font-semibold text-[var(--blue)] hover:underline">Ver todas →</Link>
      </header>

      {rows.length ? (
        <>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Quatro facturas mais recentes da empresa, ordenadas da mais recente para a mais antiga.</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">
                  <th scope="col" className="py-3 pr-4">Documento / cliente</th>
                  <th scope="col" className="py-3 pr-4">Data</th>
                  <th scope="col" className="py-3 pr-4 text-right">Valor</th>
                  <th scope="col" className="py-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => {
                  const confirmed = invoice.payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + Number(payment.amount), 0);
                  const state = getInvoiceState({ status: invoice.status, type: invoice.type, dueAt: invoice.dueAt, total: invoice.total }, confirmed);
                  return (
                    <tr key={invoice.id} className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-raised)]">
                      <td className="py-3 pr-4">
                        <Link href={`/invoices/${invoice.id}`} className="block rounded-[10px] px-1 py-1 -m-1 outline-offset-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)]">
                          <span className="font-semibold text-[var(--text)] hover:text-[var(--blue)]">{invoice.number ?? invoice.id.slice(0, 8).toUpperCase()}</span>
                          <span className="mt-0.5 block max-w-[240px] truncate text-xs text-[var(--text-muted)]">{invoice.customer?.name ?? '—'}</span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-xs text-[var(--text-muted)]">{dateOnly(invoice.issuedAt)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-bold text-[var(--text)]">{money(Number(invoice.total))}</td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: stateColors[state] ?? 'var(--text-muted)' }}>
                          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: stateColors[state] ?? 'var(--text-muted)' }} />
                          {stateLabel[state] ?? state}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:hidden">
            {rows.map((invoice) => {
              const confirmed = invoice.payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + Number(payment.amount), 0);
              const state = getInvoiceState({ status: invoice.status, type: invoice.type, dueAt: invoice.dueAt, total: invoice.total }, confirmed);
              return (
                <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-raised)] p-4 outline-offset-2 transition hover:border-[var(--blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Documento</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">{invoice.number ?? invoice.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-0.5 max-w-[180px] truncate text-xs text-[var(--text-muted)]">{invoice.customer?.name ?? '—'}</p>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[.08em]" style={{ color: stateColors[state] ?? 'var(--text-muted)', border: `1px solid ${stateColors[state] ?? 'var(--line)'}22`, background: `${stateColors[state] ?? 'var(--text-muted)'}14` }}>{stateLabel[state] ?? state}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--line)] pt-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Data</p>
                      <p className="mt-0.5 text-sm text-[var(--text)]">{dateOnly(invoice.issuedAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Valor</p>
                      <p className="tabular-nums mt-0.5 text-base font-extrabold text-[var(--text)]">{money(Number(invoice.total))}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--line)] bg-[var(--surface-raised)] px-6 py-10 text-center">
          <p className="text-sm font-semibold text-[var(--text)]">Ainda não há facturas.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">A listagem aparece aqui assim que existam facturas.</p>
          <Link href="/invoices/new" className="mt-3 inline-flex min-h-9 items-center rounded-[12px] bg-[var(--blue)] px-4 text-xs font-semibold text-white">Emitir a primeira factura</Link>
        </div>
      )}
    </section>
  );
}
