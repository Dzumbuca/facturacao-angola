'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Transferência bancária',
  MULTICAIXA_EXPRESS: 'Multicaixa Express',
  MULTICAIXA_REFERENCE: 'Referência Multicaixa',
  DEPOSIT: 'Depósito bancário',
  CASH: 'Numerário',
  OTHER: 'Outro',
};

export function ReceivableActions({
  paymentId,
  hasProof,
  reportedByClient = false,
  reference,
  notes,
  method,
  paymentDate,
}: {
  paymentId: string;
  hasProof: boolean;
  reportedByClient?: boolean;
  reference: string | null;
  notes: string | null;
  method: string;
  paymentDate: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function change(status: 'CONFIRMED' | 'CANCELLED', prompt: string) {
    if (!window.confirm(prompt)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/payments/${paymentId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Não foi possível actualizar.'); return; }
      router.refresh();
    } catch {
      setError('Erro de comunicação.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap items-center justify-end gap-2">
    <div className="hidden xl:block max-w-[260px] text-right">
      <p className="text-[11px] text-[#708195]">{methodLabels[method] ?? method} · {new Date(paymentDate).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}{reference ? ` · Ref. ${reference}` : ''}</p>
      {notes && <p className="text-[11px] text-[#708195]">{notes}</p>}
      <p className="text-xs font-semibold text-[#227958]">{reportedByClient ? 'Reportado pelo cliente' : 'Reportado pela empresa'}</p>
    </div>
    {hasProof && <a className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] bg-white px-3 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8fc]" href={`/api/payments/${paymentId}/proof`} target="_blank" rel="noreferrer">Comprovativo</a>}
    {error && <p role="alert" className="w-full text-[11px] text-red-700">{error}</p>}
    <button type="button" disabled={busy} onClick={() => change('CONFIRMED', 'Confirmas a receção deste pagamento?')} className="min-h-9 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60">Confirmar</button>
    <button type="button" disabled={busy} onClick={() => change('CANCELLED', 'Rejeitas este pagamento reportado?')} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-[#a83939] hover:bg-red-50 disabled:opacity-60">Rejeitar</button>
  </div>;
}
