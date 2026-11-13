'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  products: { id: string; name: string; codigo: string | null; stock: number }[];
  warehouses: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function TransferModal({ products, warehouses, open, onClose, onSuccess }: Props) {
  const [productId, setProductId] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!productId || !fromId || !toId) {
      setError('Selecione um produto, armazém de origem e de destino.');
      return;
    }
    if (fromId === toId) {
      setError('Os armazéns de origem e destino devem ser diferentes.');
      return;
    }
    if (selectedProduct && quantity > selectedProduct.stock) {
      setError('Não é possível transferir uma quantidade superior ao stock disponível.');
      return;
    }
    setLoading(true);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromWarehouseId: fromId, toWarehouseId: toId, items: [{ productId, quantity }] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as any)?.error || 'Erro ao criar transferência');
      setOk(`Transferência ${d.reference || d.id.slice(0, 8)} criada com sucesso.`);
      setProductId('');
      setFromId('');
      setToId('');
      setQuantity(1);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Gestão de stock</p>
            <h3 id="transfer-modal-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">Transferir stock entre armazéns</h3>
            <p className="mt-1 text-sm text-[#708195]">Mova produtos de um armazém para outro.</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={loading} onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="transfer-product" className="app-label">Produto <span className="text-[#c44747]">*</span></label>
            <select id="transfer-product" value={productId} onChange={(e) => setProductId(e.target.value)} className="ds-input" required>
              <option value="">Seleccionar produto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} {product.codigo ? `(${product.codigo})` : ''} — Stock: {product.stock}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="transfer-from" className="app-label">Armazém origem <span className="text-[#c44747]">*</span></label>
              <select id="transfer-from" value={fromId} onChange={(e) => setFromId(e.target.value)} className="ds-input" required>
                <option value="">Selecionar</option>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="transfer-to" className="app-label">Armazém destino <span className="text-[#c44747]">*</span></label>
              <select id="transfer-to" value={toId} onChange={(e) => setToId(e.target.value)} className="ds-input" required>
                <option value="">Selecionar</option>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="transfer-quantity" className="app-label">Quantidade <span className="text-[#c44747]">*</span></label>
            <input id="transfer-quantity" type="number" min="1" step="1" value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))} className="app-input tabular-nums" required />
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
          {ok && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-3 py-2.5 text-sm font-medium text-[#267256]">{ok}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'A criar…' : 'Criar transferência'}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}