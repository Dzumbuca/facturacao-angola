'use client';
import { useCallback, useEffect, useState } from 'react';

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
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/stock/movements?page=${targetPage}&limit=50`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Falha ao carregar movimentos.');
      const items: Movement[] = Array.isArray(data) ? data : (data?.items ?? []);
      setMovements(items);
      setTotal(typeof data?.total === 'number' ? data.total : items.length);
      setTotalPages(typeof data?.totalPages === 'number' ? data.totalPages : 1);
      setPage(targetPage);
    } catch (e: any) {
      setError(e.message || 'Falha ao carregar movimentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const filtered = movements.filter((m) =>
    !filter || m.product.name.toLowerCase().includes(filter.toLowerCase()) || m.type.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="border rounded-lg overflow-x-auto">
      <div className="p-3 border-b flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Pesquisar por produto ou tipo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded p-2 w-full md:w-64"
        />
        {total > 0 && <span className="text-xs text-gray-500">{total} movimento(s) no total</span>}
      </div>
      {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="p-4 text-gray-500">A carregar...</p>
      ) : (
        <>
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
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <button
              type="button"
              onClick={() => load(page - 1)}
              disabled={loading || page <= 1}
              className="rounded border px-3 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-gray-600">Página {page} de {totalPages}</span>
            <button
              type="button"
              onClick={() => load(page + 1)}
              disabled={loading || page >= totalPages}
              className="rounded border px-3 py-1 disabled:opacity-40"
            >
              Seguinte
            </button>
          </div>
        </>
      )}
    </div>
  );
}
