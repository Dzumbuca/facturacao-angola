'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type ReturnRow = {
  id: string;
  quantity: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  product?: { name: string; codigo: string | null } | null;
  warehouse?: { name: string } | null;
};

export function ReturnsClient() {
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ productId:'', warehouseId:'', quantity:1, reason:'', reference:'', creditNoteId:'' });

  const [list, setList] = useState<ReturnRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(()=>{ Promise.all([fetch('/api/stock/products',{cache:'no-store'}), fetch('/api/stock/warehouses',{cache:'no-store'})]).then(async ([p,w])=>{ const pd=await p.json().catch(()=>[]); const wd=await w.json().catch(()=>[]); if(p.ok) setProducts(Array.isArray(pd)?pd:[]); if(w.ok) setWarehouses(Array.isArray(wd)?wd:[]); }); },[]);

  const loadList = useCallback(async (targetPage: number) => {
    setListLoading(true);
    setListError('');
    try {
      const res = await fetch(`/api/stock/returns?page=${targetPage}&limit=25`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Falha ao carregar devoluções.');
      const items: ReturnRow[] = Array.isArray(data) ? data : (data?.items ?? []);
      setList(items);
      setTotal(typeof data?.total === 'number' ? data.total : items.length);
      setTotalPages(typeof data?.totalPages === 'number' ? data.totalPages : 1);
      setPage(targetPage);
    } catch (e: any) {
      setListError(e.message || 'Falha ao carregar devoluções.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadList(1); }, [loadList]);

  async function submit(e: React.FormEvent){ e.preventDefault(); setError(''); setNotice(''); if(!form.reason.trim()) { setError('Motivo obrigatório.'); return; }
    if(!window.confirm('Confirmar devolução física? Esta operação atualiza stock apenas através da API autorizada.')) return;
    setSaving(true);
    try {
      const r=await fetch('/api/stock/returns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:form.productId,warehouseId:form.warehouseId,quantity:Number(form.quantity),reason:form.reason.trim(),reference:form.reference||undefined,creditNoteId:form.creditNoteId||undefined})});
      const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error((d as any)?.error||'Erro ao registar devolução.');
      setNotice('Devolução física registada com sucesso.');
      setForm({ productId:'', warehouseId:'', quantity:1, reason:'', reference:'', creditNoteId:'' });
      await loadList(1);
    } catch(e:any){ setError(e.message||'Erro.'); } finally { setSaving(false); }
  }

  return <div className="space-y-4">
    <div><p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / Devoluções</p><h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Devoluções</h1><p className="mt-1 text-sm text-[#708195]">Registo e consulta de devoluções físicas suportadas por `POST/GET /api/stock/returns`. O stock é atualizado apenas via operação autorizada do backend.</p></div>
    {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm text-[#267256]">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}
    <form onSubmit={submit} className="rounded-lg border bg-white p-4 space-y-3">
      <h2 className="font-semibold text-[#1c2d3f]">Registar devolução física</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium text-[#607286]">Produto *</span><select className="w-full rounded-lg border p-2" required value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Selecionar</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.codigo?`${p.codigo} — `:''}{p.name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Armazém *</span><select className="w-full rounded-lg border p-2" required value={form.warehouseId} onChange={e=>setForm({...form,warehouseId:e.target.value})}><option value="">Selecionar</option>{warehouses.filter((w:any)=>w.isActive!==false).map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Quantidade *</span><input type="number" min={0.001} step="0.001" className="w-full rounded-lg border p-2" required value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Referência</span><input className="w-full rounded-lg border p-2" value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">ID nota de crédito (opcional)</span><input className="w-full rounded-lg border p-2" value={form.creditNoteId} onChange={e=>setForm({...form,creditNoteId:e.target.value})} /></label>
      </div>
      <label className="text-sm block"><span className="mb-1 block font-medium text-[#607286]">Motivo *</span><input className="w-full rounded-lg border p-2" required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Ex.: devolução física de cliente" /></label>
      <div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'A registar…':'Confirmar devolução'}</button></div>
    </form>

    <section className="rounded-lg border bg-white overflow-x-auto">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold text-[#1c2d3f]">Devoluções registadas</h2>
        {total > 0 && <span className="text-xs text-[#708195]">{total} registo(s)</span>}
      </div>
      {listError && <p role="alert" className="p-3 text-sm text-[#a83939]">{listError}</p>}
      <table className="w-full text-sm">
        <thead className="bg-[#f7f9fc] text-[#607286]">
          <tr>
            <th className="p-3 text-left">Data</th>
            <th className="p-3 text-left">Produto</th>
            <th className="p-3 text-left">Armazém</th>
            <th className="p-3 text-right">Qtd</th>
            <th className="p-3 text-left">Referência</th>
            <th className="p-3 text-left">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {!listLoading && list.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-3">{new Date(r.createdAt).toLocaleString('pt-PT')}</td>
              <td className="p-3">{r.product?.codigo ? `${r.product.codigo} — ` : ''}{r.product?.name || '-'}</td>
              <td className="p-3">{r.warehouse?.name || '-'}</td>
              <td className="p-3 text-right tabular-nums">{Number(r.quantity)}</td>
              <td className="p-3">{r.reference || '-'}</td>
              <td className="p-3">{r.reason || '-'}</td>
            </tr>
          ))}
          {listLoading && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">A carregar devoluções…</td></tr>}
          {!listLoading && list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">Sem devoluções registadas.</td></tr>}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t p-3 text-sm">
        <button type="button" onClick={() => loadList(page - 1)} disabled={listLoading || page <= 1} className="rounded border px-3 py-1 disabled:opacity-40">Anterior</button>
        <span className="text-[#607286]">Página {page} de {totalPages}</span>
        <button type="button" onClick={() => loadList(page + 1)} disabled={listLoading || page >= totalPages} className="rounded border px-3 py-1 disabled:opacity-40">Seguinte</button>
      </div>
    </section>
  </div>;
}
