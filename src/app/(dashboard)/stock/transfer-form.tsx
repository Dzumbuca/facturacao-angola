'use client';
import { useState } from 'react';

export function TransferForm({ products, warehouses, onSuccess }: {
  products: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      if (!res.ok) throw new Error(d.error || 'Erro');
      setOk(`Transferencia ${d.reference || d.id} criada (PENDING). Dispatch/rececao via PATCH /api/stock/transfers/${d.id}.`);
      setProductId(''); setFromId(''); setToId(''); setQuantity(1);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">Transferencia entre armazens</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="border rounded p-2" required>
          <option value="">Produto</option>
          {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="border rounded p-2" required>
          <option value="">Origem</option>
          {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
        </select>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className="border rounded p-2" required>
          <option value="">Destino</option>
          {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
        </select>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="border rounded p-2" required />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {ok && <p className="text-green-700 text-sm">{ok}</p>}
      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        {loading ? 'A criar...' : 'Criar transferencia'}
      </button>
      <p className="text-xs text-gray-500">Cria PENDING. Dispatch/rececao: PATCH /api/stock/transfers/:id (DISPATCH/RECEIVE).</p>
    </form>
  );
}
