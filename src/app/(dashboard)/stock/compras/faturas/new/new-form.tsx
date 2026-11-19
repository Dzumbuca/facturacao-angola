'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Supplier = { id: string; name: string; nif: string | null };
type EligibleOrder = { id: string; total: number; status: string; expectedAt: Date | null; supplier: { id: string; name: string } | null };

export function NewSupplierInvoiceForm({ suppliers, eligibleOrders }: { suppliers: Supplier[]; eligibleOrders: EligibleOrder[] }) {
  const router = useRouter();
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [number, setNumber] = useState('');
  const [total, setTotal] = useState('');
  const [taxTotal, setTaxTotal] = useState('');
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [poSuggestions, setPoSuggestions] = useState<EligibleOrder[]>(eligibleOrders);

  // When a PO is selected, auto-fill Supplier and total
  const onChoosePo = (id: string) => {
    setPurchaseOrderId(id);
    if (!id) return;
    const po = eligibleOrders.find((p) => p.id === id);
    if (po) {
      setSupplierId(po.supplier?.id ?? supplierId);
      setTotal(po.total.toFixed(2));
      setTaxTotal((po.total * 0.14).toFixed(2));
    }
  };

  const submit = async () => {
    setError('');
    const totalNum = Number(total);
    const taxTotalNum = Number(taxTotal || 0);
    if (!supplierId || !number.trim() || !Number.isFinite(totalNum) || totalNum <= 0) {
      setError('Preencha fornecedor, número e total válido.');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/stock/purchase/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        number: number.trim(),
        total: totalNum,
        taxTotal: taxTotalNum,
        issuedAt: new Date(issuedAt).toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        purchaseOrderId: purchaseOrderId || null,
        notes: notes.trim() || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? 'Falha ao registar.');
      setSubmitting(false);
      return;
    }
    router.push('/pagar');
  };

  const filteredOrders = poSuggestions.filter((po) => !supplierId || po.supplier?.id === supplierId);

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 rounded-2xl border border-[#e2e9f1] bg-white p-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-[#627068]">Ordem de compra vinculada (opcional)</label>
          <select className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" value={purchaseOrderId} onChange={(e) => onChoosePo(e.target.value)}>
            <option value="">Sem vínculo (factura independente)</option>
            {filteredOrders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.id.slice(0, 8)}… · {po.supplier?.name} · {po.status} · {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(po.total)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[#708195]">Vincula para melhor evidenciamento de compras.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#627068]">Fornecedor *</label>
          <select required className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPurchaseOrderId(''); }}>
            <option value="">Selecionar fornecedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.nif ? ` · NIF ${s.nif}` : ''}</option>)}
          </select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-[#627068]">Número da factura *</label>
          <input required minLength={1} maxLength={120} type="text" value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" placeholder="ex. FA-2026/0001" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#627068]">Total *</label>
          <input required type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#627068]">IVA</label>
          <input type="number" min="0" step="0.01" value={taxTotal} onChange={(e) => setTaxTotal(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" placeholder="0.00" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold text-[#627068]">Data de emissão</label>
          <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#627068]">Data de vencimento</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" placeholder="(sem vencimento)" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-[#627068]">Notas</label>
          <textarea rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-2.5 text-sm" placeholder="Observações opcionais…" />
        </div>
      </section>

      {error && <p role="alert" className="border-l-4 border-[#a83939] bg-[#fff4f4] px-4 py-2 text-xs font-semibold text-[#a83939]">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push('/pagar')} className="h-11 rounded-xl border border-[#e2e9f1] bg-white px-5 text-sm font-semibold text-[#627068]">Cancelar</button>
        <button type="submit" disabled={submitting} className="h-11 rounded-xl bg-[#021f87] px-5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(2,31,135,.28)] hover:bg-[#011566] disabled:opacity-60">{submitting ? 'A registar…' : 'Registar factura de fornecedor'}</button>
      </div>
    </form>
  );
}
