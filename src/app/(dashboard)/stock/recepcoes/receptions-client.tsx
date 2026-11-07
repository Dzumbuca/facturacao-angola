'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Reception = { id: string; reference?: string | null; notes?: string | null; createdAt?: string; purchaseOrder?: { id: string; status?: string } | null; warehouse?: { name: string } | null; items?: { quantity: number }[] };

export function ReceptionsClient() {
  const [items, setItems] = useState<Reception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/stock/purchase/receptions', { cache: 'no-store' });
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error((d as any)?.error || 'Erro ao carregar receções.');
      setItems(Array.isArray(d) ? d : []);
    } catch (e: any) { setError(e.message || 'Erro ao carregar.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / Receções</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Receções de mercadorias</h1>
          <p className="mt-1 text-sm text-[#708195]">Histórico real de receções por armazém e encomenda (API `/api/stock/purchase/receptions`).</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock/compras" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-[#1c2d3f] hover:bg-[#f7f9fc]">Ir para compras</Link>
          <button type="button" onClick={load} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f67b7] disabled:opacity-50" disabled={loading}>{loading ? 'A carregará' : 'Atualizar'}</button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Referência</th><th className="p-3 text-left">Encomenda</th><th className="p-3 text-left">Armazém</th><th className="p-3 text-right">Itens</th><th className="p-3 text-left">Data</th><th className="p-3"></th></tr></thead>
          <tbody>
            {!loading && items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium text-[#1c2d3f]">{r.reference || r.id.slice(0,8)}</td>
                <td className="p-3">{r.purchaseOrder?.id ? <Link className="text-[#2878d0] hover:underline" href={`/stock/compras/${r.purchaseOrder.id}`}>{r.purchaseOrder.id.slice(0,8)}</Link> : '-'}</td>
                <td className="p-3">{r.warehouse?.name || '-'}</td>
                <td className="p-3 text-right tabular-nums">{r.items?.length || 0}</td>
                <td className="p-3">{r.createdAt ? new Date(r.createdAt).toLocaleString('pt-PT') : '-'}</td>
                <td className="p-3 text-right">{r.purchaseOrder?.id && <Link href={`/stock/compras/${r.purchaseOrder.id}`} className="text-[#2878d0] hover:underline">Ver encomenda</Link>}</td>
              </tr>
            ))}
            {loading && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">A carregar receções…</td></tr>}
            {!loading && items.length===0 && !error && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">Sem receções registadas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
