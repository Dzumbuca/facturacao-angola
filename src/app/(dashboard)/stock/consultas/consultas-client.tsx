'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export function ConsultasClient() {
  const [movements, setMovements] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ productId:'', warehouseId:'', q:'' });

  async function load() {
    setLoading(true); setError('');
    try {
      const [mRes,bRes,pRes,wRes]=await Promise.all([
        fetch('/api/stock/movements',{cache:'no-store'}),
        fetch(`/api/stock/balances${filters.warehouseId||filters.productId?`?warehouseId=${encodeURIComponent(filters.warehouseId||'')}&productId=${encodeURIComponent(filters.productId||'')}`:''}`,{cache:'no-store'}),
        fetch('/api/stock/products',{cache:'no-store'}),
        fetch('/api/stock/warehouses',{cache:'no-store'}),
      ]);
      const m=await mRes.json().catch(()=>[]), b=await bRes.json().catch(()=>[]), p=await pRes.json().catch(()=>[]), w=await wRes.json().catch(()=>[]);
      if(mRes.ok) setMovements(Array.isArray(m)?m:(m?.items??[])); if(bRes.ok) setBalances(Array.isArray(b)?b:[]); if(pRes.ok) setProducts(Array.isArray(p)?p:[]); if(wRes.ok) setWarehouses(Array.isArray(w)?w:[]);
      if(!mRes.ok && !bRes.ok) throw new Error('Erro ao carregar dados de consulta.');
    } catch(e:any){ setError(e.message||'Erro ao carregar.'); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);

  const filteredMov = useMemo(()=>movements.filter((m:any)=>{
    if(filters.productId && m.productId!==filters.productId) return false;
    if(filters.warehouseId && m.warehouseId!==filters.warehouseId) return false;
    if(filters.q){ const s=`${m.product?.name||''} ${m.type||''} ${m.reference||''} ${m.reason||''}`.toLowerCase(); if(!s.includes(filters.q.toLowerCase())) return false; }
    return true;
  }),[movements,filters]);

  return <div className="space-y-4">
    <div><p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / Consultas</p><h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Movimentos e saldos</h1><p className="mt-1 text-sm text-[#708195]">Valores reais de `/api/stock/movements` e `/api/stock/balances` (por produto/armazém/lote quando disponível).</p></div>
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}
    <div className="rounded-lg border bg-white p-4 grid gap-3 md:grid-cols-4">
      <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Produto</span><select className="w-full rounded-lg border p-2" value={filters.productId} onChange={e=>setFilters({...filters,productId:e.target.value})}><option value="">Todos</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Armazém</span><select className="w-full rounded-lg border p-2" value={filters.warehouseId} onChange={e=>setFilters({...filters,warehouseId:e.target.value})}><option value="">Todos</option>{warehouses.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium text-[#607286]">Pesquisa</span><input className="w-full rounded-lg border p-2" value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})} placeholder="Produto, tipo, referência, motivo…" /></label>
      <div className="md:col-span-4 flex justify-end"><button type="button" onClick={load} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={loading}>{loading?'A carregará':'Aplicar/Atualizar'}</button></div>
    </div>

    <section className="rounded-lg border bg-white overflow-x-auto">
      <div className="border-b p-3 font-semibold text-[#1c2d3f]">Saldos por produto/armazém</div>
      <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Produto</th><th className="p-3 text-left">Armazém</th><th className="p-3 text-left">Lote</th><th className="p-3 text-right">Qtd</th><th className="p-3 text-right">Reservada</th><th className="p-3 text-right">Disponível</th></tr></thead>
        <tbody>
          {!loading && balances.map((b:any)=>{ const q=Number(b.quantity||0); const r=Number(b.reservedQuantity||0); return <tr key={b.id||`${b.productId}-${b.warehouseId}-${b.lotId||''}`} className="border-t"><td className="p-3">{b.product?.name||b.productId?.slice(0,8)||'-'}</td><td className="p-3">{b.warehouse?.name||b.warehouseId?.slice(0,8)||'-'}</td><td className="p-3">{b.lot?.lotNumber||'-'}</td><td className="p-3 text-right tabular-nums">{q}</td><td className="p-3 text-right tabular-nums">{r}</td><td className="p-3 text-right tabular-nums font-medium">{Math.max(0,q-r)}</td></tr>; })}
          {loading && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">A carregar saldos…</td></tr>}
          {!loading && balances.length===0 && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">Sem saldos para os filtros.</td></tr>}
        </tbody>
      </table>
    </section>

    <section className="rounded-lg border bg-white overflow-x-auto">
      <div className="border-b p-3 font-semibold text-[#1c2d3f]">Movimentos</div>
      <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Data</th><th className="p-3 text-left">Produto</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-right">Qtd</th><th className="p-3 text-left">Referência</th><th className="p-3 text-left">Motivo</th></tr></thead>
        <tbody>
          {!loading && filteredMov.slice(0,200).map((m:any)=><tr key={m.id} className="border-t"><td className="p-3">{m.createdAt?new Date(m.createdAt).toLocaleString('pt-PT'):'-'}</td><td className="p-3">{m.product?.name||m.productId?.slice(0,8)||'-'}</td><td className="p-3">{m.type||'-'}</td><td className="p-3 text-right tabular-nums">{m.quantitySigned ?? m.quantity ?? '-'}</td><td className="p-3">{m.reference||'-'}</td><td className="p-3">{m.reason||'-'}</td></tr>)}
          {loading && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">A carregar movimentos…</td></tr>}
          {!loading && filteredMov.length===0 && <tr><td colSpan={6} className="p-6 text-center text-[#708195]">Sem movimentos para os filtros.</td></tr>}
        </tbody>
      </table>
    </section>
  </div>;
}
