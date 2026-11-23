'use client';

import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Transferência bancária',
  MULTICAIXA_EXPRESS: 'Multicaixa Express',
  MULTICAIXA_REFERENCE: 'Referência Multicaixa',
  DEPOSIT: 'Depósito bancário',
  CASH: 'Numerário',
  OTHER: 'Outro',
};

const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_PROOF_BYTES = 3 * 1024 * 1024;

export function ClientReportPayment({
  token,
  outstanding,
  currency = 'AOA',
}: {
  token: string;
  outstanding: number;
  currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  useEffect(() => { setAmount(outstanding.toFixed(2)); }, [outstanding]);

  async function onProofChange(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    const file = event.target.files?.[0] ?? null;
    if (file) {
      if (!ALLOWED_PROOF_TYPES.includes(file.type)) { setError('O comprovativo deve ser uma imagem (JPG, PNG, WebP) ou PDF.'); event.target.value = ''; setProof(null); return; }
      if (file.size > MAX_PROOF_BYTES) { setError('O comprovativo deve ter no máximo 3 MB.'); event.target.value = ''; setProof(null); return; }
    }
    setProof(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setBusy(true);
    try {
      const input = parseFloat(amount);
      if (!Number.isFinite(input) || input <= 0) { setError('Valor inválido.'); return; }
      if (input > outstanding + 0.01) { setError('O valor excede o saldo em aberto.'); return; }
      const form = new FormData();
      form.set('token', token);
      form.set('amount', input.toFixed(2));
      form.set('method', method);
      form.set('reference', reference);
      form.set('notes', notes);
      form.set('paymentDate', paymentDate);
      form.set('idempotencyKey', idempotencyKey);
      if (proof) form.set('proof', proof);
      const response = await fetch('/api/public/informed-payment', { method: 'POST', body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Não foi possível registar. Tenta novamente.'); return; }
      setDone(true);
      setOpen(false);
    } catch {
      setError('Não foi possível comunicar com o servidor.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <div role="status" className="rounded-2xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-sm leading-6 text-[#227958]"><p className="font-bold">Obrigado! Recebemos o teu aviso de pagamento.</p><p className="mt-1">A empresa irá confirmar em breve. O comprovativo, quando anexado, ajuda na confirmação mais rápida.</p></div>;
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#2878d0] transition hover:bg-[#f4f8fc] print:hidden">Informei que já paguei</button>;
  }

  return <form onSubmit={submit} className="print:hidden space-y-3 rounded-2xl border border-[#e2e9f1] bg-white p-4 shadow-sm">
    <h3 className="font-bold text-[#1c2d3f]">Aviso de pagamento</h3>
    <p className="text-xs leading-5 text-[#708195]">Informa a empresa que fizeste o pagamento. A empresa confirma após verificação.</p>
    <label className="block"><span className="app-label">Valor ({currency})</span><input className="ds-input" type="number" step="0.01" min="0.01" max={outstanding} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="app-label">Método</span><select className="ds-input" value={method} onChange={(event) => setMethod(event.target.value)}>{Object.entries(methodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block"><span className="app-label">Data do pagamento</span><input className="ds-input" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
    </div>
    <label className="block"><span className="app-label">Referência <span className="font-normal text-[#708195]">(opcional)</span></span><input className="ds-input" type="text" maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} autoComplete="off" /></label>
    <label className="block"><span className="app-label">Observações <span className="font-normal text-[#708195]">(opcional)</span></span><input className="ds-input" type="text" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} autoComplete="off" /></label>
    <label className="block"><span className="app-label">Comprovativo <span className="font-normal text-[#708195]">(imagem ou PDF, máx. 3 MB — opcional)</span></span><input className="ds-input file:mr-3 file:rounded-md file:border-0 file:bg-[#2878d0] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#216bbd]" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onProofChange} /></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center gap-2"><button type="submit" disabled={busy || !idempotencyKey} className="min-h-10 rounded-lg bg-[#2878d0] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'A enviar…' : 'Informar pagamento'}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-[#cdddeb] px-4 text-sm font-semibold text-[#607286]">Cancelar</button></div>
  </form>;
}
