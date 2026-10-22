'use client';

import Link from 'next/link';
import { useState } from 'react';

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
const stateChipClass = (state: string) =>
  state === 'OVERDUE' ? 'bg-red-50 text-red-700' : state === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#eef4fa] text-[#48627a]';

// Tabs instantâneas no cliente: ambos os listados vêm já carregados do servidor,
// trocar de aba não faz novos pedidos.
export function InvoicesTabs({ issuedRows, draftRows }: { issuedRows: IssuedRow[]; draftRows: DraftRow[] }) {
  const [tab, setTab] = useState<'issued' | 'drafts'>('issued');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('issued')} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'issued' ? 'bg-[#102b46] text-white' : 'bg-[#f0f4f8] text-[#52667a] hover:bg-[#e6edf5]'}`}>Emitidas ({issuedRows.length})</button>
        <button type="button" onClick={() => setTab('drafts')} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'drafts' ? 'bg-[#102b46] text-white' : 'bg-[#f0f4f8] text-[#52667a] hover:bg-[#e6edf5]'}`}>Rascunhos ({draftRows.length})</button>
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
        <div className="overflow-x-auto rounded-2xl border border-[#e2e9f1] bg-white">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-[#f7f9fc] text-xs uppercase tracking-wide text-[#708195]"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th></tr></thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {issuedRows.map((row) => (
                <tr key={row.id} className="hover:bg-[#fbfcfe]">
                  <td className="px-4 py-3"><Link href={`/invoices/${row.id}`} className="font-semibold text-[#2878d0] hover:underline">{row.number}</Link><span className="ml-2 text-xs text-[#708195]">{row.type}</span></td>
                  <td className="px-4 py-3 text-[#30465c]">{row.customerName}</td>
                  <td className="px-4 py-3 text-[#607286]">{new Date(row.issuedAtISO).toLocaleDateString('pt-AO')}</td>
                  <td className="px-4 py-3 text-[#607286]">{row.dueAtISO ? new Date(row.dueAtISO).toLocaleDateString('pt-AO') : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1c2d3f]">{money(row.total)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateChipClass(row.state)}`}>{stateLabel[row.state] ?? row.state}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {issuedRows.length === 0 && <p className="p-8 text-center text-sm text-[#708195]">Nenhuma factura encontrada para este filtro.</p>}
        </div>
      )}
    </div>
  );
}
