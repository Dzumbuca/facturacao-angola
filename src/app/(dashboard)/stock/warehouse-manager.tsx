'use client';
import { useState } from 'react';

export function WarehouseManager({ warehouses }: { warehouses: { id: string; name: string; location: string | null }[] }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stock/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro');
      }
      setName('');
      setLocation('');
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">Armazéns</h2>
      <ul className="text-sm space-y-1">
        {warehouses.map((w) => (
          <li key={w.id} className="flex justify-between">
            <span>{w.name}</span>
            <span className="text-gray-500">{w.location || '-'}</span>
          </li>
        ))}
        {warehouses.length === 0 && <li className="text-gray-500">Nenhum armazém.</li>}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input type="text" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="border rounded p-2 flex-1" required />
        <input type="text" placeholder="Localização" value={location} onChange={(e) => setLocation(e.target.value)} className="border rounded p-2 flex-1" />
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {loading ? '...' : 'Criar'}
        </button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
