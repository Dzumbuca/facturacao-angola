'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useWarehouseStock } from './use-warehouse-stock';

type Props = {
  products: { id: string; name: string; codigo: string | null; stock: number }[];
  warehouses: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type FieldErrors = { productId?: string; warehouseId?: string; quantity?: string };

export function MovementModal({ products, warehouses, open, onClose, onSuccess }: Props) {
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { available, checking } = useWarehouseStock(productId, warehouseId, open);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    if (error) setError('');
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!productId) next.productId = 'Escolhe o produto que vai entrar ou sair.';
    if (!warehouseId) next.warehouseId = 'Escolhe o armazém onde o movimento acontece.';
    if (!Number.isFinite(quantity) || quantity < 1) next.quantity = 'Indica uma quantidade igual ou superior a 1.';
    else if (type === 'OUT' && available !== null && quantity > available) {
      next.quantity = `Só existem ${available} unidades neste armazém.`;
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setError('Corrige os campos assinalados para continuar.');
      return false;
    }
    setError('');
    return true;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, warehouseId, type, quantity, reason }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as any)?.error || 'Erro ao registar movimento');
      setProductId('');
      setWarehouseId('');
      setQuantity(1);
      setReason('');
      setFieldErrors({});
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
      <section role="dialog" aria-modal="true" aria-labelledby="movement-modal-title"
        className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Gestão de stock</p>
            <h3 id="movement-modal-title" className="mt-1 text-lg font-bold text-[#1c2d3f] sm:text-xl">Registar movimento de stock</h3>
            <p className="mt-1 text-sm text-[#708195]">Registe uma entrada, saída ou ajuste de stock.</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={loading} onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
        </div>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="movement-product" className="app-label">Produto <span className="text-[#c44747]">*</span></label>
            <select
              id="movement-product"
              value={productId}
              onChange={(e) => { setProductId(e.target.value); clearFieldError('productId'); clearFieldError('quantity'); }}
              className={`app-input ${fieldErrors.productId ? 'border-[#d98a8a]' : ''}`}
              aria-invalid={Boolean(fieldErrors.productId)}
              aria-describedby={fieldErrors.productId ? 'movement-product-error' : undefined}
              required
            >
              <option value="">Seleccionar produto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} {product.codigo ? `(${product.codigo})` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.productId && <p id="movement-product-error" className="mt-1 text-xs font-medium text-[#a83939]">{fieldErrors.productId}</p>}
          </div>

          <div>
            <label htmlFor="movement-warehouse" className="app-label">Armazém <span className="text-[#c44747]">*</span></label>
            <select
              id="movement-warehouse"
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); clearFieldError('warehouseId'); clearFieldError('quantity'); }}
              className={`app-input ${fieldErrors.warehouseId ? 'border-[#d98a8a]' : ''}`}
              aria-invalid={Boolean(fieldErrors.warehouseId)}
              aria-describedby={fieldErrors.warehouseId ? 'movement-warehouse-error' : undefined}
              required
            >
              <option value="">Selecionar armazém</option>
              {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
            </select>
            {fieldErrors.warehouseId && <p id="movement-warehouse-error" className="mt-1 text-xs font-medium text-[#a83939]">{fieldErrors.warehouseId}</p>}
            {productId && warehouseId && (
              <p className="mt-1 text-xs text-[#708195]">
                {checking ? 'A verificar stock neste armazém…' : available === null ? '' : available > 0 ? `Disponível neste armazém: ${available}` : 'Sem stock neste armazém.'}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="movement-type" className="app-label">Tipo de movimento <span className="text-[#c44747]">*</span></label>
              <select id="movement-type" value={type} onChange={(e) => { setType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT'); clearFieldError('quantity'); }} className="app-input" required>
                <option value="IN">Entrada</option>
                <option value="OUT">Saída</option>
                <option value="ADJUSTMENT">Ajuste</option>
              </select>
            </div>
            <div>
              <label htmlFor="movement-quantity" className="app-label">Quantidade <span className="text-[#c44747]">*</span></label>
              <input
                id="movement-quantity"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={Number.isFinite(quantity) ? quantity : ''}
                onChange={(e) => { setQuantity(Number(e.target.value)); clearFieldError('quantity'); }}
                className={`app-input tabular-nums ${fieldErrors.quantity ? 'border-[#d98a8a]' : ''}`}
                aria-invalid={Boolean(fieldErrors.quantity)}
                aria-describedby={fieldErrors.quantity ? 'movement-quantity-error' : undefined}
                required
              />
              {fieldErrors.quantity && <p id="movement-quantity-error" className="mt-1 text-xs font-medium text-[#a83939]">{fieldErrors.quantity}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="movement-reason" className="app-label">Motivo <span className="font-normal text-[#708195]">(opcional)</span></label>
            <input id="movement-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="app-input" placeholder="Ex.: compra, venda, quebra" />
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex flex-col-reverse gap-2 border-t border-[#e7edf3] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:px-0 sm:pb-0">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="w-full sm:w-auto">Cancelar</Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">{loading ? 'A registar…' : 'Registar movimento'}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
