'use client';
import { useState } from 'react';

export function StockMovementForm({ products, onSuccess }: { products: { id: string; name: string; stock: number }[]; onSuccess: () => void }) {
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('IN');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, type, quantity, reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro');
      }
      setProductId('');
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
      <h2 className="font-semibold">Registar movimento</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="border rounded p-2" required>
          <option value="">Produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded p-2">
          <option value="IN">Entrada</option>
          <option value="OUT">Saída</option>
          <option value="ADJUSTMENT">Ajuste</option>
        </select>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="border rounded p-2" required />
        <input type="text" placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} className="border rounded p-2" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        {loading ? 'A registar...' : 'Registar'}
      </button>
    </form>
  );
}
