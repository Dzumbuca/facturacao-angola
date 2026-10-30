'use client';
import { useEffect, useState } from 'react';

type Movement = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { name: string; codigo: string | null };
};

export function StockHistory() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stock/movements')
      .then((r) => r.json())
      .then((d) => { setMovements(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = movements.filter((m) =>
    !filter || m.product.name.toLowerCase().includes(filter.toLowerCase()) || m.type.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="border rounded-lg overflow-x-auto">
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Pesquisar por produto ou tipo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded p-2 w-full md:w-64"
        />
      </div>
      {loading ? (
        <p className="p-4 text-gray-500">A carregar...</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Produto</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-right p-2">Quantidade</th>
              <th className="text-left p-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{new Date(m.createdAt).toLocaleString('pt-PT')}</td>
                <td className="p-2">{m.product.name}</td>
                <td className="p-2">{m.type === 'IN' ? 'Entrada' : m.type === 'OUT' ? 'Saída' : 'Ajuste'}</td>
                <td className="p-2 text-right">{m.quantity}</td>
                <td className="p-2">{m.reason || '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">Sem movimentos.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
