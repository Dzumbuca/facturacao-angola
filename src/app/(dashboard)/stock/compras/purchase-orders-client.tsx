'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

type Order = { id: string; status: string; total: number; createdAt: string; expectedAt?: string | null; receivedAt?: string | null; supplier?: { name: string } | null; items?: { quantity: number; receivedQty: number }[] };

function statusLabel(s: string) {
  const m: Record<string, string> = { PENDENTE: 'Pendente', PARCIAL: 'Parcial', RECEIVED: 'Recebida', CANCELLED: 'Cancelada' };
  return m[s] || s;
}
function statusCls(s: string) {
  if (s === 'RECEIVED') return 'bg-[#eff9f4] text-[#267256]';
  if (s === 'PARCIAL') return 'bg-amber-50 text-amber-700';
  if (s === 'CANCELLED') return 'bg-red-50 text-[#a83939]';
  return 'bg-[#f3f6fa] text-[#607286]';
}

export function PurchaseOrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; codigo: string | null }[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/stock/purchase/orders', { cache: 'no-store' });
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error((d as any)?.error || 'Erro ao carregar encomendas.');
      setOrders(Array.isArray(d) ? d : []);
    } catch (e: any) { setError(e.message || 'Erro ao carregar.'); }
    finally { setLoading(false); }
  }

  async function openCreate() {
    setError(''); setNotice(''); setShowCreate(true);
    try {
      const [sRes, pRes] = await Promise.all([fetch('/api/stock/suppliers', { cache: 'no-store' }), fetch('/api/stock/products', { cache: 'no-store' })]);
      const s = await sRes.json().catch(() => []);
      if (sRes.ok) setSuppliers(Array.isArray(s) ? s : []);
      if (pRes.ok) { const p = await pRes.json().catch(() => []); setProducts(Array.isArray(p) ? p : []); }
      else setProducts([]);
    } catch { setError('Não foi possível carregar fornecedores/produtos.'); }
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = {
        supplierId,
        expectedDate: expectedDate || undefined,
        items: items.filter((i) => i.productId && Number(i.quantity) > 0).map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice || 0) })),
      };
      const r = await fetch('/api/stock/purchase/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || 'Erro ao criar encomenda.');
      setNotice(((d as any)?.warnings?.length ? (d as any).warnings.join(' ') + ' ' : '') + ((d as any)?.warehouseNote || 'Encomenda criada.'));
      setShowCreate(false); setSupplierId(''); setExpectedDate(''); setItems([{ productId: '', quantity: 1, unitPrice: 0 }]);
      await refresh();
    } catch (e: any) { setError(e.message || 'Erro ao criar.'); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(() => orders.filter((o) => !query || (o.supplier?.name || '').toLowerCase().includes(query.toLowerCase()) || o.id.toLowerCase().includes(query.toLowerCase()) || (o.status || '').toLowerCase().includes(query.toLowerCase())), [orders, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / Compras</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Compras e recepções</h1>
          <p className="mt-1 text-sm text-[#708195]">Ordens de compra e registo de receção. O armazém é indicado na receção (modelo atual).</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-[#1c2d3f] hover:bg-[#f7f9fc] disabled:opacity-50" disabled={loading}>{loading ? 'A atualizar…' : 'Atualizar'}</button>
          <button type="button" onClick={openCreate} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f67b7]">Nova encomenda</button>
        </div>
      </div>
      {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm text-[#267256]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}

      {showCreate && (
        <form onSubmit={createOrder} className="rounded-lg border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-[#1c2d3f]">Nova ordem de compra</h2><button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[#708195] hover:underline">Fechar</button></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Fornecedor *</span>
              <select className="w-full rounded-lg border p-2" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Selecionar fornecedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {suppliers.length === 0 && <span className="mt-1 block text-xs text-amber-700">Sem fornecedores carregados. Registe fornecedores no tenant ou use a API /api/stock/suppliers.</span>}
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Data prevista</span><input type="date" className="w-full rounded-lg border p-2" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></label>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className="text-sm font-medium text-[#607286]">Itens *</span><button type="button" className="text-sm text-[#2878d0] hover:underline" onClick={() => setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }])}>+ Adicionar item</button></div>
            {items.map((it, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[2fr_120px_140px_auto]">
                <select className="rounded-lg border p-2" required value={it.productId} onChange={(e) => setItems(items.map((x,i)=>i===idx?{...x,productId:e.target.value}:x))}>
                  <option value="">Produto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} — ` : ''}{p.name}</option>)}
                </select>
                <input type="number" min={1} step="0.001" className="rounded-lg border p-2" required value={it.quantity} onChange={(e) => setItems(items.map((x,i)=>i===idx?{...x,quantity:Number(e.target.value)}:x))} placeholder="Qtd" />
                <input type="number" min={0} step="0.01" className="rounded-lg border p-2" value={it.unitPrice} onChange={(e) => setItems(items.map((x,i)=>i===idx?{...x,unitPrice:Number(e.target.value)}:x))} placeholder="Preço unit." />
                <button type="button" className="rounded-lg border px-3 py-2 text-sm text-[#a83939] hover:bg-red-50" onClick={() => setItems(items.filter((_,i)=>i!==idx))} disabled={items.length===1}>Remover</button>
              </div>
            ))}
            {products.length === 0 && <p className="text-xs text-amber-700">Produtos não carregados por API dedicada. Se necessário, use os produtos existentes do stock; a API de encomendas valida fornecedor/itens no servidor.</p>}
          </div>
          <div className="rounded-lg bg-[#f7f9fc] p-3 text-sm text-[#607286]">O armazém de destino não é definido na encomenda (modelo atual sem migration). Será selecionado obrigatoriamente no registo da receção.</div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={saving || !supplierId || items.every(i=>!i.productId)} className="rounded-lg bg-[#2878d0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'A criar…' : 'Criar encomenda'}</button></div>
        </form>
      )}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <div className="border-b p-3"><input className="w-full md:w-80 rounded-lg border p-2 text-sm" placeholder="Pesquisar por fornecedor, estado ou ID…" value={query} onChange={(e)=>setQuery(e.target.value)} /></div>
        <table className="w-full text-sm">
          <thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Encomenda</th><th className="p-3 text-left">Fornecedor</th><th className="p-3 text-left">Estado</th><th className="p-3 text-right">Itens</th><th className="p-3 text-right">Recebido</th><th className="p-3 text-right">Total</th><th className="p-3 text-left">Criada</th><th className="p-3"></th></tr></thead>
          <tbody>
            {filtered.map((o) => {
              const qty = (o.items||[]).reduce((s,i)=>s+Number(i.quantity||0),0);
              const recv = (o.items||[]).reduce((s,i)=>s+Number(i.receivedQty||0),0);
              return (
                <tr key={o.id} className="border-t">
                  <td className="p-3 font-medium text-[#1c2d3f]">{o.id.slice(0,8)}</td>
                  <td className="p-3">{o.supplier?.name || '-'}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td className="p-3 text-right tabular-nums">{o.items?.length || 0}</td>
                  <td className="p-3 text-right tabular-nums">{recv}/{qty}</td>
                  <td className="p-3 text-right tabular-nums">{Number(o.total||0).toLocaleString('pt-PT',{minimumFractionDigits:2})}</td>
                  <td className="p-3">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-PT') : '-'}</td>
                  <td className="p-3 text-right whitespace-nowrap"><Link href={`/stock/compras/${o.id}`} className="text-[#2878d0] hover:underline mr-3">Detalhes</Link>{o.status!=='RECEIVED' && o.status!=='CANCELLED' && <Link href={`/stock/compras/${o.id}?receber=1`} className="text-[#267256] hover:underline">Receber</Link>}</td>
                </tr>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={8} className="p-6 text-center text-[#708195]">Sem encomendas. {suppliers.length===0 && !loading ? 'Crie uma encomenda quando tiver fornecedores e produtos.' : ''}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
