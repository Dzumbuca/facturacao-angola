'use client';
import { useState } from 'react';

export function TransferForm({ products, warehouses, onSuccess }: {
  products: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  onSuccess: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, fromWarehouseId: fromId, toWarehouseId: toId, quantity, reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro');
      }
      setProductId('');
      setFromId('');
      setToId('');
      setQuantity(1);
      setReason('');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">Transferência entre armazéns</h2>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="border rounded p-2" required>
          <option value="">Produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="border rounded p-2" required>
          <option value="">Origem</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className="border rounded p-2" required>
          <option value="">Destino</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="border rounded p-2" required />
        <input type="text" placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} className="border rounded p-2" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        {loading ? 'A transferir...' : 'Transferir'}
      </button>
    </form>
  );
}
