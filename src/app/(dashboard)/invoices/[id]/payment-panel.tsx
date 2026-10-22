'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

type PaymentEvent = { id: string; eventType: string; createdAt: string; previousStatus: string | null; nextStatus: string | null };
type Payment = { id: string; amount: number; method: string; status: string; paymentDate: string; reference: string | null; notes: string | null; events: PaymentEvent[] };
const methodLabels: Record<string, string> = { BANK_TRANSFER: 'Transferência bancária', MULTICAIXA_EXPRESS: 'Multicaixa Express', MULTICAIXA_REFERENCE: 'Referência Multicaixa', CASH: 'Numerário', OTHER: 'Outro' };
const statusLabels: Record<string, string> = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', REVERSED: 'Estornado' };

export function PaymentPanel({ invoiceId, invoiceStatus, total, initialPayments, defaultMethod }: { invoiceId: string; invoiceStatus: string; total: number; initialPayments: Payment[]; defaultMethod?: string }) {
  const router = useRouter();
  const [payments, setPayments] = useState(initialPayments);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(defaultMethod && defaultMethod in methodLabels ? defaultMethod : 'BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmed = useMemo(() => payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + payment.amount, 0), [payments]);
  const pending = useMemo(() => payments.filter((payment) => payment.status === 'PENDING').reduce((sum, payment) => sum + payment.amount, 0), [payments]);
  const available = Math.max(0, total - confirmed - pending);

  async function addPayment(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, method, paymentDate, reference: reference || null, notes: notes || null, idempotencyKey: crypto.randomUUID() }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Não foi possível registar o pagamento.'); return; }
      setPayments((current) => [{ ...data.payment, amount: Number(data.payment.amount), paymentDate: data.payment.paymentDate, events: [{ id: crypto.randomUUID(), eventType: 'CREATED', createdAt: new Date().toISOString(), previousStatus: null, nextStatus: 'PENDING' }] }, ...current]);
      setAmount(''); setReference(''); setNotes(''); router.refresh();
    } catch { setError('Não foi possível comunicar com o servidor.'); }
    finally { setBusy(false); }
  }

  async function changeStatus(id: string, status: 'CONFIRMED' | 'CANCELLED' | 'REVERSED') {
    const prompt = status === 'CONFIRMED' ? 'Confirma que verificaste o recebimento fora do sistema?' : status === 'REVERSED' ? 'Confirmas o estorno deste recebimento?' : 'Confirmas o cancelamento deste pagamento pendente?';
    if (!window.confirm(prompt)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/payments/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Não foi possível actualizar o pagamento.'); return; }
      setPayments((current) => current.map((payment) => payment.id === id ? { ...payment, status, events: [...payment.events, { id: crypto.randomUUID(), eventType: status, createdAt: new Date().toISOString(), previousStatus: payment.status, nextStatus: status }] } : payment)); router.refresh();
    } catch { setError('Não foi possível comunicar com o servidor.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5 rounded-2xl border border-[#e2e9f1] bg-white p-5 md:p-6">
    <div><h3 className="font-bold text-[#1c2d3f]">Recebimentos</h3><p className="mt-1 text-sm text-[#708195]">Recebido: {confirmed.toLocaleString('pt-AO')} AOA · Pendente: {pending.toLocaleString('pt-AO')} AOA · Saldo: {Math.max(0, total - confirmed).toLocaleString('pt-AO')} AOA</p></div>
    {invoiceStatus === 'ISSUED' && available > 0 && <form onSubmit={addPayment} className="grid gap-3 rounded-xl bg-[#f7f9fc] p-4 sm:grid-cols-2 xl:grid-cols-3">
      <div><label htmlFor="payment-amount" className="app-label">Valor (AOA)</label><input id="payment-amount" type="number" min="0.01" max={available} step="0.01" className="app-input" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
      <div><label htmlFor="payment-method" className="app-label">Método</label><select id="payment-method" className="app-input" value={method} onChange={(event) => setMethod(event.target.value)}>{Object.entries(methodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div><label htmlFor="payment-date" className="app-label">Data do pagamento</label><input id="payment-date" type="date" className="app-input" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></div>
      <div><label htmlFor="payment-reference" className="app-label">Referência <span className="font-normal text-[#708195]">(opcional)</span></label><input id="payment-reference" className="app-input" value={reference} maxLength={160} onChange={(event) => setReference(event.target.value)} /></div>
      <div><label htmlFor="payment-notes" className="app-label">Observações</label><input id="payment-notes" className="app-input" value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} /></div>
      <div className="flex items-end"><button disabled={busy} className="min-h-10 w-full rounded-lg bg-[#2878d0] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'A guardar…' : 'Registar pendente'}</button></div>
      {(method === 'MULTICAIXA_EXPRESS' || method === 'MULTICAIXA_REFERENCE') && <p className="text-xs text-amber-800 sm:col-span-2 xl:col-span-3">O registo Multicaixa é manual. Confirme o pagamento fora do sistema antes de o marcar como recebido.</p>}
    </form>}
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {payments.length ? <ul className="divide-y divide-[#edf1f5]">{payments.map((payment) => <li key={payment.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#263c52]">{methodLabels[payment.method] ?? payment.method} · {payment.amount.toLocaleString('pt-AO')} AOA</p><p className="mt-1 text-xs text-[#708195]">{new Date(payment.paymentDate).toLocaleDateString('pt-AO')}{payment.reference ? ` · Ref. ${payment.reference}` : ''}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#eef4fa] px-2.5 py-1 text-xs font-semibold text-[#48627a]">{statusLabels[payment.status] ?? payment.status}</span>{payment.status === 'PENDING' && <><button type="button" disabled={busy} onClick={() => changeStatus(payment.id, 'CONFIRMED')} className="min-h-9 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-800">Confirmar</button><button type="button" disabled={busy} onClick={() => changeStatus(payment.id, 'CANCELLED')} className="min-h-9 rounded-lg border border-[#d8e1eb] px-3 text-xs font-semibold text-[#607286]">Cancelar</button></>}{payment.status === 'CONFIRMED' && <button type="button" disabled={busy} onClick={() => changeStatus(payment.id, 'REVERSED')} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Estornar</button>}</div></div><ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#708195]">{payment.events.map((event) => <li key={event.id}>{statusLabels[event.nextStatus ?? event.eventType] ?? event.eventType} · {new Date(event.createdAt).toLocaleString('pt-AO')}</li>)}</ol></li>)}</ul> : <p className="rounded-xl bg-[#f7f9fc] p-5 text-center text-sm text-[#708195]">Ainda não há recebimentos registados.</p>}
  </section>;
}
