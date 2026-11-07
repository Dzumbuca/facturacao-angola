'use client';
import { useState } from 'react';

export function StockMovementForm({
  products,
  warehouses,
  onSuccess,
}: {
  products: { id: string; name: string; stock: number }[];
  warehouses: { id: string; name: string }[];
  onSuccess: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
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
        body: JSON.stringify({ productId, warehouseId, type, quantity, reason }),
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="border rounded p-2" required>
          <option value="">Produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
          ))}
        </select>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="border rounded p-2" required>
          <option value="">Armazem</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded p-2">
          <option value="IN">Entrada</option>
          <option value="OUT">Saida</option>
          <option value="ADJUSTMENT">Ajuste</option>
        </select>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="border rounded p-2" required />
        <input type="text" placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} className="border rounded p-2" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading || !warehouseId} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        {loading ? 'A registar...' : 'Registar'}
      </button>
      {warehouses.length === 0 && <p className="text-sm text-amber-700">Crie um armazem antes de registar movimentos.</p>}
    </form>
  );
}
