'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export function AdjustmentsClient() {
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ warehouseId:'', reason:'', productId:'', type:'INCREASE', quantity:1, itemReason:'' });

  async function load() {
    setLoading(true); setError('');
    try {
      const [aRes,pRes,wRes]=await Promise.all([fetch('/api/stock/adjustments',{cache:'no-store'}), fetch('/api/stock/products',{cache:'no-store'}), fetch('/api/stock/warehouses',{cache:'no-store'})]);
      const a=await aRes.json().catch(()=>[]), p=await pRes.json().catch(()=>[]), w=await wRes.json().catch(()=>[]);
      if(aRes.ok) setItems(Array.isArray(a)?a:[]); if(pRes.ok) setProducts(Array.isArray(p)?p:[]); if(wRes.ok) setWarehouses(Array.isArray(w)?w:[]);
    } catch(e:any){ setError(e.message||'Erro ao carregar.'); } finally { setLoading(false); }
  }
  useEffect(()=>{load();},[]);

  async function submit(e: React.FormEvent){ e.preventDefault(); setError(''); setNotice(''); if(!form.reason.trim()) { setError('Motivo obrigatório.'); return; }
    if(!window.confirm(`${form.type==='INCREASE'?'Aumentar':'Reduzir'} stock do produto selecionado? Esta operação afeta saldos reais.`)) return;
    setSaving(true);
    try {
      const r=await fetch('/api/stock/adjustments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({warehouseId:form.warehouseId,reason:form.reason.trim(),items:[{productId:form.productId,quantity:Number(form.quantity),type:form.type,reason:form.itemReason||undefined}]})});
      const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error((d as any)?.error||'Erro ao registar ajuste.');
      setNotice(`Ajuste ${ (d as any)?.adjustmentNumber || '' } registado.`);
      setForm(f=>({...f,productId:'',quantity:1,itemReason:''})); await load();
    } catch(e:any){ setError(e.message||'Erro.'); } finally { setSaving(false); }
  }

  return <div className="space-y-4">
    <div><p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / Ajustes</p><h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Ajustes de inventário</h1><p className="mt-1 text-sm text-[#708195]">API real `/api/stock/adjustments`. Motivo obrigatório e confirmação antes de executar.</p></div>
    {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm text-[#267256]">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}
    <form onSubmit={submit} className="rounded-lg border bg-white p-4 space-y-3">
      <h2 className="font-semibold text-[#1c2d3f]">Novo ajuste</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Armazém *</span><select className="w-full rounded-lg border p-2" required value={form.warehouseId} onChange={e=>setForm({...form,warehouseId:e.target.value})}><option value="">Selecionar</option>{warehouses.filter((w:any)=>w.isActive!==false).map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Motivo do ajuste *</span><input className="w-full rounded-lg border p-2" required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Ex.: inventário físico, quebra, correção" /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium text-[#607286]">Produto *</span><select className="w-full rounded-lg border p-2" required value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Selecionar</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.codigo?`${p.codigo} — `:''}{p.name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Tipo *</span><select className="w-full rounded-lg border p-2" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="INCREASE">Aumento</option><option value="DECREASE">Redução</option></select></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Quantidade *</span><input type="number" min={0.001} step="0.001" className="w-full rounded-lg border p-2" required value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} /></label>
      </div>
      <label className="text-sm block"><span className="mb-1 block font-medium text-[#607286]">Motivo do item (opcional)</span><input className="w-full rounded-lg border p-2" value={form.itemReason} onChange={e=>setForm({...form,itemReason:e.target.value})} /></label>
      <div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'A registará':'Confirmar e registar ajuste'}</button></div>
    </form>
    <div className="rounded-lg border bg-white overflow-x-auto">
      <div className="border-b p-3 flex justify-between"><span className="font-semibold text-[#1c2d3f]">Ajustes registados</span><button type="button" onClick={load} className="rounded-lg border px-3 py-2 text-sm">Atualizar</button></div>
      <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Referência</th><th className="p-3 text-left">Armazém</th><th className="p-3 text-left">Motivo</th><th className="p-3 text-right">Itens</th><th className="p-3 text-left">Data</th></tr></thead>
        <tbody>{!loading && items.map((a:any)=><tr key={a.id} className="border-t"><td className="p-3 font-medium">{a.adjustmentNumber||a.id.slice(0,8)}</td><td className="p-3">{a.warehouse?.name||'-'}</td><td className="p-3">{a.reason||'-'}</td><td className="p-3 text-right">{a.items?.length||0}</td><td className="p-3">{a.createdAt?new Date(a.createdAt).toLocaleString('pt-PT'):'-'}</td></tr>)}{loading && <tr><td colSpan={5} className="p-6 text-center text-[#708195]">A carregará</td></tr>}{!loading && items.length===0 && <tr><td colSpan={5} className="p-6 text-center text-[#708195]">Sem ajustes.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}
