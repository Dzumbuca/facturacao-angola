'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge, stateTone, EmptyState } from '@/components/ui/data-table';
const ISSUED_TONE: 'success' | 'primary' = 'success';

type IssuedRow = {
  id: string;
  number: string;
  type: string;
  customerName: string;
  issuedAtISO: string;
  dueAtISO: string | null;
  total: number;
  state: string;
};

type DraftRow = { id: string; customerName: string; updatedAtISO: string };

const stateLabel: Record<string, string> = {
  DRAFT: 'Rascunho', CANCELLED: 'Anulada', PAID: 'Paga', PARTIALLY_PAID: 'Parcialmente paga', OVERDUE: 'Vencida', ISSUED: 'Emitida',
};
const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
const _unusedChipClass = (state: string) =>
  state === 'OVERDUE' ? 'bg-red-50 text-red-700' : state === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#eef4fa] text-[#48627a]';

// Tabs instantâneas no cliente: ambos os listados vêm já carregados do servidor,
// trocar de aba não faz novos pedidos.
export function InvoicesTabs({ issuedRows, draftRows }: { issuedRows: IssuedRow[]; draftRows: DraftRow[] }) {
  const [tab, setTab] = useState<'issued' | 'drafts'>('issued');
  const [sortKey, setSortKey] = useState<'date' | 'total' | 'customer'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const showDue = issuedRows.some((r) => r.dueAtISO);

  return (
    <div className="space-y-4">
      {/* Totalizador */}
      <div className="grid grid-cols-1 gap-3 rounded-[16px] border border-[var(--line)] bg-[var(--surface-raised)] px-5 py-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Total facturado</p>
          <p className="tabular-nums mt-1 text-2xl font-extrabold text-[var(--text)]">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(issuedRows.reduce((s, r) => s + r.total, 0))}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Facturas emitidas</p>
          <p className="tabular-nums mt-1 text-2xl font-extrabold text-[var(--text)]">{issuedRows.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Vencidas</p>
          <p className="tabular-nums mt-1 text-2xl font-extrabold text-[var(--danger)]">{issuedRows.filter((r) => r.state === 'OVERDUE').length}</p>
        </div>
      </div>

            <div role="tablist" aria-label="Tipo de documento" className="flex gap-1 border-b border-[var(--line)]">
        <button role="tab" aria-selected={tab === 'issued'} onClick={() => setTab('issued')} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === 'issued' ? 'border-[var(--blue)] text-[var(--blue)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}`}>Emitidas ({issuedRows.length})</button>
        <button role="tab" aria-selected={tab === 'drafts'} onClick={() => setTab('drafts')} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === 'drafts' ? 'border-[var(--blue)] text-[var(--blue)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}`}>Rascunhos ({draftRows.length})</button>
      </div>

      {tab === 'drafts' ? (
        draftRows.length ? (
          <div className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
            {draftRows.map((draft) => (
              <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f5] p-4 last:border-0">
                <div>
                  <p className="font-semibold text-[#263c52]">{draft.customerName}</p>
                  <p className="mt-1 text-xs text-[#708195]">Guardado {new Date(draft.updatedAtISO).toLocaleString('pt-AO')}</p>
                </div>
                <Link href={`/invoices/drafts/${draft.id}/edit`} className="rounded-lg border border-[#cdddeb] px-3 py-2 text-sm font-semibold text-[#2878d0]">Continuar</Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-white p-8 text-center text-sm text-[#708195]">Não há rascunhos guardados.</p>
        )
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">Facturas emitidas ordenadas da mais recente para a mais antiga. Total: {issuedRows.reduce((s, r) => s + r.total, 0).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}.</caption>
            <thead><tr><th className="bg-[var(--surface-raised)] px-5 py-3 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]">Documento</th><th className="bg-[var(--surface-raised)] px-5 py-3 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]"><button type="button" onClick={() => { setSortKey('customer'); setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }} aria-sort={sortKey === 'customer' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="hover:text-[var(--text)]">Cliente{sortKey === 'customer' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th><th className="bg-[var(--surface-raised)] px-5 py-3 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]"><button type="button" onClick={() => { setSortKey('date'); setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }} aria-sort={sortKey === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="hover:text-[var(--text)]">Emissão{sortKey === 'date' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>{showDue && <th className="bg-[var(--surface-raised)] px-5 py-3 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]">Vencimento</th>}<th className="bg-[var(--surface-raised)] px-5 py-3 text-right text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]"><button type="button" onClick={() => { setSortKey('total'); setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }} aria-sort={sortKey === 'total' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="hover:text-[var(--text)]">Total{sortKey === 'total' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th><th className="bg-[var(--surface-raised)] px-5 py-3 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]">Estado</th><th className="bg-[var(--surface-raised)] px-5 py-3 text-right text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]">Acção</th></tr></thead>
            <tbody className="divide-y divide-[var(--line)]">
              {[...issuedRows].sort((a, b) => {
                const cmp = sortKey === 'date' ? new Date(a.issuedAtISO).getTime() - new Date(b.issuedAtISO).getTime() : sortKey === 'total' ? a.total - b.total : a.customerName.localeCompare(b.customerName);
                return sortDir === 'asc' ? cmp : -cmp;
              }).map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--surface-raised)]">
                  <td className="px-5 py-3.5"><Link href={`/invoices/${row.id}`} className="font-bold text-[var(--blue)] hover:underline underline-offset-4">{row.number}</Link></td>
                  <td className="px-5 py-3.5 font-medium text-[var(--text)]">{row.customerName}</td>
                  <td className="px-5 py-3.5 text-[var(--text-muted)]">{new Date(row.issuedAtISO).toLocaleDateString('pt-AO')}</td>
                  {showDue && <td className="px-5 py-3.5 text-[var(--text-muted)]">{row.dueAtISO ? new Date(row.dueAtISO).toLocaleDateString('pt-AO') : '—'}</td>}
                  <td className="px-5 py-3.5 text-right tabular-nums font-bold text-[var(--text)]">{money(row.total)}</td>
                  <td className="px-5 py-3.5"><StatusBadge tone={row.state === 'ISSUED' ? ISSUED_TONE : stateTone(row.state)}>{stateLabel[row.state] ?? row.state}</StatusBadge></td>
                  <td className="px-5 py-3.5 text-right"><Link href={`/invoices/${row.id}`} aria-label={`Ver ${row.number}`} className="inline-flex min-h-9 items-center rounded-[8px] border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue)] hover:border-[var(--blue)]">Ver →</Link></td>
                </tr>
              ))}
              {issuedRows.length === 0 && (
                <tr><td colSpan={showDue ? 7 : 6} className="px-5 py-6"><EmptyState title="Nenhuma factura" description="Não há facturas para o filtro seleccionado. Ajuste a vista ou emita uma nova factura." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
