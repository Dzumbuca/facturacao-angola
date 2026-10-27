'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BusinessDocumentStatus } from '@/lib/business-document-core';

export function BusinessDocumentActions({ id, status, canConvert }: { id: string; status: BusinessDocumentStatus; canConvert: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function transition(next: BusinessDocumentStatus) {
    if (next === 'CANCELLED' && !window.confirm('Confirma o cancelamento deste documento?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/business-documents/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Não foi possível actualizar o estado.'); return; }
      router.refresh();
    } catch { setError('Falha de comunicação com o servidor.'); }
    finally { setBusy(false); }
  }
  async function convert() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/business-documents/${id}/convert-to-invoice`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Não foi possível converter o documento.'); return; }
      router.push(`/invoices/drafts/${data.draftId}/edit`);
    } catch { setError('Falha de comunicação com o servidor.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">
    {status === 'DRAFT' && <><button disabled={busy} onClick={() => transition('ISSUED')} className="rounded-lg bg-[#021F87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Emitir</button><button disabled={busy} onClick={() => transition('CANCELLED')} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Cancelar</button></>}
    {status === 'ISSUED' && <><button disabled={busy} onClick={() => transition('ACCEPTED')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Marcar como aceite</button><button disabled={busy} onClick={() => transition('REJECTED')} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Marcar como rejeitado</button><button disabled={busy} onClick={() => transition('CANCELLED')} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Cancelar</button></>}
    {status === 'ACCEPTED' && <><button disabled={busy} onClick={() => transition('CANCELLED')} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Cancelar</button>{canConvert && <button disabled={busy} onClick={convert} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Converter em rascunho de factura</button>}</>}
  </div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
