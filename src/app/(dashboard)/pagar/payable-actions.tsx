'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function PayableActions({ invoiceId, outstanding }: { invoiceId: string; outstanding: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const submitPayment = () => {
    setError('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Insira um valor positivo.');
      return;
    }
    if (value > outstanding) {
      setError('O valor excede o saldo pendente.');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/stock/purchase/invoices/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'payment', amount: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Falha ao registar pagamento.');
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  const cancelInvoice = () => {
    if (!confirm('Cancelar esta factura do fornecedor? Mantém o registo no histórico mas deixa de contar como obrigação futura.')) return;
    startTransition(async () => {
      const res = await fetch(`/api/stock/purchase/invoices/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'Falha ao cancelar.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setOpen((v) => !v)} className="h-9 rounded-xl border border-[#021f87] bg-white px-3 text-xs font-semibold text-[#021f87] hover:bg-[#021f87] hover:text-white">
          Registar pagamento
        </button>
        <button onClick={cancelInvoice} className="h-9 rounded-xl border border-[#e2e9f1] bg-white px-3 text-xs font-semibold text-[#627068] hover:bg-[#f4f7fa]">
          Cancelar
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1c2d3f]">Registar pagamento</h3>
            <p className="mt-1 text-xs text-[#708195]">Indique o valor a pagar. O sistema assume um compromisso imediato; saldos parciais mantêm a fatura em aberto.</p>
            <label className="mt-4 block text-xs font-semibold text-[#627068]">Valor (AOA)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2 text-sm" />
            <p className="mt-1 text-xs text-[#708195]">Saldo disponível: {outstanding.toFixed(2)} AOA</p>
            {error && <p role="alert" className="mt-2 text-xs font-semibold text-[#a83939]">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="h-10 rounded-xl border border-[#e2e9f1] bg-white px-4 text-xs font-semibold text-[#627068]">Cancelar</button>
              <button disabled={isPending} onClick={submitPayment} className="h-10 rounded-xl bg-[#021f87] px-4 text-xs font-semibold text-white hover:bg-[#011566] disabled:opacity-60">
                {isPending ? 'A processar…' : 'Confirmar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
