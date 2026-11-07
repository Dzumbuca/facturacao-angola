'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Res = { id: string; status: string; quantity: number; orderReference?: string|null; expiresAt?: string|null; createdAt?: string; product?: {name:string}|null; warehouse?: {name:string}|null; productId:string; warehouseId:string };

export function ReservationsClient() {
  const [items, setItems] = useState<Res[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ productId:'', warehouseId:'', quantity:1, orderReference:'', expiresAt:'' });

  async function load() {
    setLoading(true); setError('');
    try {
      const [rRes,pRes,wRes] = await Promise.all([fetch('/api/stock/reservations',{cache:'no-store'}), fetch('/api/stock/products',{cache:'no-store'}), fetch('/api/stock/warehouses',{cache:'no-store'})]);
      const r=await rRes.json().catch(()=>[]), p=await pRes.json().catch(()=>[]), w=await wRes.json().catch(()=>[]);
      if(!rRes.ok) throw new Error((r as any)?.error||'Erro ao carregar reservas.');
      setItems(Array.isArray(r)?r:[]); if(pRes.ok) setProducts(Array.isArray(p)?p:[]); if(wRes.ok) setWarehouses(Array.isArray(w)?w:[]);
    } catch(e:any){ setError(e.message||'Erro ao carregar.'); } finally { setLoading(false); }
  }
  useEffect(()=>{load();},[]);

  async function create(e: React.FormEvent){ e.preventDefault(); setSaving(true); setError(''); setNotice(''); try {
    const r=await fetch('/api/stock/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:form.productId,warehouseId:form.warehouseId,quantity:Number(form.quantity),orderReference:form.orderReference||undefined,expiresAt:form.expiresAt||undefined})});
    const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error((d as any)?.error||'Erro ao criar reserva.');
    setNotice('Reserva criada (ACTIVE). Stock disponível ajustado pelas regras da API.');
    setForm({ productId:'', warehouseId:'', quantity:1, orderReference:'', expiresAt:'' }); await load();
  } catch(e:any){ setError(e.message||'Erro.'); } finally { setSaving(false); } }

  async function act(id:string, action:'RELEASE'|'FULFILL'){ if(!window.confirm(`Confirmar ${action==='RELEASE'?'libertação':'consumo'} da reserva?`)) return; setError(''); setNotice(''); try {
    const r=await fetch(`/api/stock/reservations/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error((d as any)?.error||'Erro na operação.');
    setNotice(action==='RELEASE'?'Reserva libertada.':'Reserva consumida.'); await load();
  } catch(e:any){ setError(e.message||'Erro.'); } }

  return <div className="space-y-4">
    <div><p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / Reservas</p><h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Reservas de stock</h1><p className="mt-1 text-sm text-[#708195]">API real `/api/stock/reservations`. Respeita stock disponível, PWS e isolamento por tenant.</p></div>
    {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm text-[#267256]">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}
    <form onSubmit={create} className="rounded-lg border bg-white p-4 space-y-3">
      <h2 className="font-semibold text-[#1c2d3f]">Criar reserva</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium text-[#607286]">Produto *</span><select className="w-full rounded-lg border p-2" required value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Selecionar</option>{products.map(p=><option key={p.id} value={p.id}>{p.codigo?`${p.codigo} — `:''}{p.name} (stock {p.stock??'-'})</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Armazém *</span><select className="w-full rounded-lg border p-2" required value={form.warehouseId} onChange={e=>setForm({...form,warehouseId:e.target.value})}><option value="">Selecionar</option>{warehouses.filter((w:any)=>w.isActive!==false).map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Quantidade *</span><input type="number" min={0.001} step="0.001" className="w-full rounded-lg border p-2" required value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Referência (opcional)</span><input className="w-full rounded-lg border p-2" value={form.orderReference} onChange={e=>setForm({...form,orderReference:e.target.value})} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Expira em</span><input type="datetime-local" className="w-full rounded-lg border p-2" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})} /></label>
      </div>
      <div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'A criará':'Criar reserva'}</button></div>
    </form>
    <div className="rounded-lg border bg-white overflow-x-auto">
      <div className="border-b p-3 flex justify-between"><span className="font-semibold text-[#1c2d3f]">Reservas</span><button type="button" onClick={load} className="rounded-lg border px-3 py-2 text-sm">Atualizar</button></div>
      <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Produto</th><th className="p-3 text-left">Armazém</th><th className="p-3 text-right">Qtd</th><th className="p-3 text-left">Estado</th><th className="p-3 text-left">Referência</th><th className="p-3"></th></tr></thead>
        <tbody>
          {!loading && items.map(r=><tr key={r.id} className="border-t"><td className="p-3">{r.product?.name||r.productId.slice(0,8)}</td><td className="p-3">{r.warehouse?.name||r.warehouseId.slice(0,8)}</td><td className="p-3 text-right tabular-nums">{Number(r.quantity)}</td><td className="p-3"><span className="rounded-full bg-[#f3f6fa] px-2 py-0.5 text-xs font-semibold text-[#607286]">{r.status}</span></td><td className="p-3">{r.orderReference||'-'}</td><td className="p-3 text-right whitespace-nowrap">{r.status==='ACTIVE' && <><button className="text-amber-700 hover:underline mr-3" onClick={()=>act(r.id,'RELEASE')}>Libertar</button><button className="text-[#267256] hover:underline" onClick={()=>act(r.id,'FULFILL')}>Consumir</button></>}</td></tr>)}
          {loading && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">A carregará</td></tr>}
          {!loading && items.length===0 && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">Sem reservas.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
