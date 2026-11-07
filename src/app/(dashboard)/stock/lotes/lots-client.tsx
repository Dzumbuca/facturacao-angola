'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lot = { id: string; lotNumber: string; expiryDate?: string | null; receivedAt?: string | null; productId: string; product?: { name: string; codigo?: string | null } | null };

function daysUntil(d?: string | null) {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function LotsClient() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [products, setProducts] = useState<{id:string;name:string;codigo?:string|null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ productId: '', lotNumber: '', expiryDate: '', receivedAt: '' });

  async function load() {
    setLoading(true); setError('');
    try {
      const [lRes, pRes] = await Promise.all([fetch('/api/stock/lots', { cache: 'no-store' }), fetch('/api/stock/products', { cache: 'no-store' })]);
      const l = await lRes.json().catch(() => []); const p = await pRes.json().catch(() => []);
      if (!lRes.ok) throw new Error((l as any)?.error || 'Erro ao carregar lotes.');
      setLots(Array.isArray(l) ? l : []);
      if (pRes.ok) setProducts(Array.isArray(p) ? p : []);
    } catch (e: any) { setError(e.message || 'Erro ao carregar.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const r = await fetch('/api/stock/lots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: form.productId, lotNumber: form.lotNumber, expiryDate: form.expiryDate || undefined, receivedAt: form.receivedAt || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || 'Erro ao registar lote.');
      setNotice('Lote registado.');
      setForm({ productId: '', lotNumber: '', expiryDate: '', receivedAt: '' });
      await load();
    } catch (e: any) { setError(e.message || 'Erro ao registar.'); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(() => lots.filter((l) => !q || `${l.lotNumber} ${l.product?.name||''} ${l.product?.codigo||''}`.toLowerCase().includes(q.toLowerCase())), [lots, q]);

  return (
    <div className="space-y-4">
      <div><p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / Lotes</p><h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Lotes e validades</h1><p className="mt-1 text-sm text-[#708195]">API real `/api/stock/lots`. Limitação do schema atual (sem migration): StockLot não possui <code>quantity</code> nem <code>manufactureDate</code> — esses campos não são apresentados como persistidos.</p></div>
      {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm text-[#267256]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}
      <form onSubmit={submit} className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-semibold text-[#1c2d3f]">Registar lote</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium text-[#607286]">Produto *</span><select className="w-full rounded-lg border p-2" required value={form.productId} onChange={(e)=>setForm({...form,productId:e.target.value})}><option value="">Selecionar</option>{products.map((p)=><option key={p.id} value={p.id}>{p.codigo?`${p.codigo} — `:''}{p.name}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Número do lote *</span><input className="w-full rounded-lg border p-2" required value={form.lotNumber} onChange={(e)=>setForm({...form,lotNumber:e.target.value})} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Validade</span><input type="date" className="w-full rounded-lg border p-2" value={form.expiryDate} onChange={(e)=>setForm({...form,expiryDate:e.target.value})} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Data de receção</span><input type="date" className="w-full rounded-lg border p-2" value={form.receivedAt} onChange={(e)=>setForm({...form,receivedAt:e.target.value})} /></label>
        </div>
        <div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'A registará':'Registar lote'}</button></div>
      </form>
      <div className="rounded-lg border bg-white overflow-x-auto">
        <div className="border-b p-3 flex gap-2 items-center justify-between"><input className="w-full md:w-80 rounded-lg border p-2 text-sm" placeholder="Pesquisar lote/produto…" value={q} onChange={(e)=>setQ(e.target.value)} /><button type="button" onClick={load} className="rounded-lg border px-3 py-2 text-sm">Atualizar</button></div>
        <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Lote</th><th className="p-3 text-left">Produto</th><th className="p-3 text-left">Receção</th><th className="p-3 text-left">Validade</th><th className="p-3 text-left">Estado validade</th></tr></thead>
          <tbody>
            {!loading && filtered.map((l)=>{ const d=daysUntil(l.expiryDate); const st = d==null?'Sem validade': d<0?'Expirado': d<=30?'Próximo da validade':'OK'; const cls = st==='Expirado'?'text-[#a83939] bg-red-50':st==='Próximo da validade'?'text-amber-700 bg-amber-50':'text-[#267256] bg-[#eff9f4]'; return <tr key={l.id} className="border-t"><td className="p-3 font-medium">{l.lotNumber}</td><td className="p-3">{l.product?.name||l.productId.slice(0,8)}</td><td className="p-3">{l.receivedAt?new Date(l.receivedAt).toLocaleDateString('pt-PT'):'-'}</td><td className="p-3">{l.expiryDate?new Date(l.expiryDate).toLocaleDateString('pt-PT'):'-'}</td><td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d==null?'bg-[#f3f6fa] text-[#607286]':cls}`}>{st}{d!=null?` (${d}d)`:''}</span></td></tr>; })}
            {loading && <tr><td colSpan={5} className="p-6 text-center text-[#708195]">A carregar lotes…</td></tr>}
            {!loading && filtered.length===0 && <tr><td colSpan={5} className="p-6 text-center text-[#708195]">Sem lotes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
