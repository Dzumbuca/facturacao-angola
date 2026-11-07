'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Transfer = {
  id: string; reference?: string | null; status: string;
  fromWarehouse?: { name: string } | null; toWarehouse?: { name: string } | null;
  items?: { quantity: number; productId: string }[];
  createdAt?: string;
};

export function TransferList() {
  const router = useRouter();
  const [items, setItems] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/stock/transfers');
      const d = await res.json().catch(() => []);
      setItems(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, action: 'DISPATCH'|'RECEIVE'|'CANCEL') {
    setBusy(id + action); setErr('');
    try {
      const res = await fetch(`/api/stock/transfers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Erro');
      await load(); router.refresh();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Transferencias</h2><button type="button" onClick={load} className="text-sm text-blue-700 underline">Atualizar</button></div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {loading ? <p className="text-sm text-gray-500">A carregar...</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr>
          <th className="text-left p-2">Ref</th><th className="text-left p-2">Origem</th><th className="text-left p-2">Destino</th><th className="text-left p-2">Estado</th><th className="text-right p-2">Itens</th><th className="p-2">Acoes</th>
        </tr></thead><tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{t.reference || t.id.slice(0,8)}</td>
              <td className="p-2">{t.fromWarehouse?.name || '-'}</td>
              <td className="p-2">{t.toWarehouse?.name || '-'}</td>
              <td className="p-2">{t.status}</td>
              <td className="p-2 text-right">{t.items?.length || 0}</td>
              <td className="p-2 space-x-2 whitespace-nowrap">
                {t.status === 'PENDING' && <button disabled={!!busy} onClick={() => act(t.id,'DISPATCH')} className="px-2 py-1 rounded bg-amber-600 text-white disabled:opacity-50">{busy===t.id+'DISPATCH'?'...':'Expedir'}</button>}
                {t.status === 'IN_TRANSIT' && <button disabled={!!busy} onClick={() => act(t.id,'RECEIVE')} className="px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50">{busy===t.id+'RECEIVE'?'...':'Receber'}</button>}
                {(t.status === 'PENDING' || t.status === 'IN_TRANSIT') && <button disabled={!!busy} onClick={() => act(t.id,'CANCEL')} className="px-2 py-1 rounded bg-gray-600 text-white disabled:opacity-50">Cancelar</button>}
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">Sem transferencias.</td></tr>}
        </tbody></table></div>
      )}
    </div>
  );
}
