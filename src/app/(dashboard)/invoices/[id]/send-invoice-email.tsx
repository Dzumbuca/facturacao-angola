'use client';

import { useState, type FormEvent } from 'react';

export function SendInvoiceEmail({ invoiceId, customerEmail }: { invoiceId: string; customerEmail: string | null }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  if (!customerEmail) return <p className="text-sm text-amber-800">Adicione um email ao cadastro do cliente para enviar esta factura.</p>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const recipient = String(form.get('recipient') ?? '').trim();
    if (!window.confirm(`Enviar a factura para ${recipient}?`)) return;
    setBusy(true); setMessage('');
    try { const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient }) }); const data = await response.json(); setMessage(data.message ?? data.error); }
    catch { setMessage('Não foi possível enviar a factura. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Enviar factura por email</h2><p className="mt-1 text-sm text-slate-600">O PDF será gerado no servidor. O destinatário tem de corresponder ao email do cliente guardado.</p><label className="app-label mt-4" htmlFor="invoice-recipient">Confirmar destinatário</label><input id="invoice-recipient" name="recipient" type="email" required maxLength={254} defaultValue={customerEmail} className="app-input mt-1"/><button disabled={busy} className="mt-3 rounded-lg bg-[#2878d0] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? 'A enviar…' : 'Confirmar e enviar PDF'}</button>{message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}</form>;
}
