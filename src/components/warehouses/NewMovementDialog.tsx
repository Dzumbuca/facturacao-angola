'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Product = {
  id: string;
  name: string;
  stock: number;
};

type Props = {
  products: Product[];
  onSuccess: () => void;
};

export function NewMovementDialog({ products, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (type === 'OUT' && selectedProduct && quantity > selectedProduct.stock) {
        setError('Não é possível registar uma saída superior ao stock disponível.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, type, quantity, reason, reference }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao registar movimento');
      }

      setProductId('');
      setType('IN');
      setQuantity(1);
      setReason('');
      setReference('');
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={loading || products.length === 0}>
        Novo movimento
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="movement-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Controlo de inventário</p>
                <h3 id="movement-form-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">Registar movimento de stock</h3>
                <p className="mt-1 text-sm text-[#708195]">Registe uma entrada, saída ou ajuste de stock.</p>
              </div>
              <button type="button" aria-label="Fechar" disabled={loading} onClick={() => setOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="movement-product" className="app-label">Produto <span className="text-[#c44747]">*</span></label>
                <select id="movement-product" value={productId} onChange={(e) => setProductId(e.target.value)} required className="app-input">
                  <option value="">Seleccionar produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} (Stock: {product.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="movement-type" className="app-label">Tipo de movimento <span className="text-[#c44747]">*</span></label>
                  <select id="movement-type" value={type} onChange={(e) => setType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')} required className="app-input">
                    <option value="IN">Entrada</option>
                    <option value="OUT">Saída</option>
                    <option value="ADJUSTMENT">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="movement-quantity" className="app-label">Quantidade <span className="text-[#c44747]">*</span></label>
                  <input id="movement-quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required className="app-input tabular-nums" />
                </div>
              </div>
              <div>
                <label htmlFor="movement-reason" className="app-label">Motivo</label>
                <input id="movement-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo do movimento" className="app-input" />
              </div>
              <div>
                <label htmlFor="movement-reference" className="app-label">Referência <span className="font-normal text-[#708195]">(opcional)</span></label>
                <input id="movement-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referência (opcional)" className="app-input" />
              </div>
              {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading || !productId}>{loading ? 'A registar…' : 'Registar'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
