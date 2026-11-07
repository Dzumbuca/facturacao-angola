'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Item = { id: string; productId: string; quantity: number; receivedQty: number; productName?: string };
type Order = { id: string; status: string; total: number; createdAt: string; expectedAt?: string | null; receivedAt?: string | null; supplier?: { name: string } | null; items: Item[] };
type Warehouse = { id: string; name: string; isActive?: boolean };

function statusLabel(s: string) { return ({ PENDENTE: 'Pendente', PARCIAL: 'Parcial', RECEIVED: 'Recebida', CANCELLED: 'Cancelada' } as any)[s] || s; }
function statusCls(s: string) { if (s === 'RECEIVED') return 'bg-[#eff9f4] text-[#267256]'; if (s === 'PARCIAL') return 'bg-amber-50 text-amber-700'; return 'bg-[#f3f6fa] text-[#607286]'; }

export function PurchaseOrderDetailClient({ initialOrder, warehouses, productsById }: { initialOrder: Order; warehouses: Warehouse[]; productsById: Record<string, string> }) {
  const sp = useSearchParams();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [showReceive, setShowReceive] = useState(sp.get('receber') === '1' && !['RECEIVED','CANCELLED'].includes(initialOrder.status));
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [qtys, setQtys] = useState<Record<string, number>>(() => Object.fromEntries(initialOrder.items.map((i) => [i.id, Math.max(0, Number(i.quantity)-Number(i.receivedQty||0))])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const pending = useMemo(() => order.items.filter((i) => Number(i.quantity) - Number(i.receivedQty||0) > 1e-9), [order.items]);

  async function refresh() {
    const r = await fetch('/api/stock/purchase/orders', { cache: 'no-store' });
    const d = await r.json().catch(() => []);
    if (r.ok && Array.isArray(d)) {
      const found = d.find((x: any) => x.id === order.id);
      if (found) setOrder({
        id: found.id, status: found.status, total: Number(found.total||0), createdAt: found.createdAt, expectedAt: found.expectedAt, receivedAt: found.receivedAt,
        supplier: found.supplier ? { name: found.supplier.name } : null,
        items: (found.items||[]).map((i:any)=>({ id:i.id, productId:i.productId, quantity:Number(i.quantity), receivedQty:Number(i.receivedQty||0), productName: productsById[i.productId] })),
      });
    }
  }

  async function submitReception(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const receiveItems = pending.map((i) => ({ purchaseOrderItemId: i.id, productId: i.productId, quantity: Number(qtys[i.id] || 0) })).filter((i) => i.quantity > 0);
      if (!warehouseId) throw new Error('Selecione o armazém de destino da receção.');
      if (receiveItems.length === 0) throw new Error('Indique pelo menos uma quantidade a receber.');
      const r = await fetch('/api/stock/purchase/receptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseOrderId: order.id, warehouseId, notes: notes || undefined, items: receiveItems }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || 'Erro ao registar receção.');
      setNotice(`Receção registada (${(d as any)?.reference || 'ok'}). Estado da encomenda atualizado.`);
      setShowReceive(false); setWarehouseId(''); setNotes('');
      await refresh();
    } catch (e: any) { setError(e.message || 'Erro ao receber.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[#708195]"><Link href="/stock" className="hover:underline">Stock</Link> / <Link href="/stock/compras" className="hover:underline">Compras</Link> / Detalhe</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Encomenda {order.id.slice(0,8)}</h1>
          <p className="mt-1 text-sm text-[#708195]">Fornecedor: {order.supplier?.name || '-'} — <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls(order.status)}`}>{statusLabel(order.status)}</span></p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock/recepcoes" className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-[#1c2d3f] hover:bg-[#f7f9fc]">Ver receções</Link>
          {!['RECEIVED','CANCELLED'].includes(order.status) && <button type="button" onClick={() => setShowReceive((v)=>!v)} className="rounded-lg bg-[#267256] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f5f48]">{showReceive ? 'Fechar receção' : 'Registar receção'}</button>}
        </div>
      </div>
      {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm text-[#267256]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <div className="border-b p-3 font-semibold text-[#1c2d3f]">Itens e quantidades recebidas</div>
        <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Produto</th><th className="p-3 text-right">Pedido</th><th className="p-3 text-right">Recebido</th><th className="p-3 text-right">Pendente</th></tr></thead>
          <tbody>{order.items.map((i)=>{ const pendingQty = Math.max(0, Number(i.quantity)-Number(i.receivedQty||0)); return <tr key={i.id} className="border-t"><td className="p-3">{productsById[i.productId] || i.productId.slice(0,8)}</td><td className="p-3 text-right tabular-nums">{Number(i.quantity)}</td><td className="p-3 text-right tabular-nums">{Number(i.receivedQty||0)}</td><td className="p-3 text-right tabular-nums font-medium">{pendingQty}</td></tr>; })}
            {order.items.length===0 && <tr><td colSpan={4} className="p-6 text-center text-[#708195]">Sem itens.</td></tr>}
          </tbody>
        </table>
      </div>

      {showReceive && !['RECEIVED','CANCELLED'].includes(order.status) && (
        <form onSubmit={submitReception} className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="font-semibold text-[#1c2d3f]">Registar receção de mercadorias</h2>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-900">Seleção obrigatória do armazém no momento da receção. O armazém não é definido na encomenda (modelo atual).</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Armazém de destino *</span>
              <select className="w-full rounded-lg border p-2" required value={warehouseId} onChange={(e)=>setWarehouseId(e.target.value)}>
                <option value="">Selecionar armazém</option>
                {warehouses.filter(w=>w.isActive!==false).map((w)=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="mb-1 block font-medium text-[#607286]">Notas</span><input className="w-full rounded-lg border p-2" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Observações (opcional)" /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-2 text-left">Produto</th><th className="p-2 text-right">Pendente</th><th className="p-2 text-right">Receber agora</th></tr></thead>
              <tbody>{pending.map((i)=> <tr key={i.id} className="border-t"><td className="p-2">{productsById[i.productId] || i.productId.slice(0,8)}</td><td className="p-2 text-right tabular-nums">{Number(i.quantity)-Number(i.receivedQty||0)}</td><td className="p-2 text-right"><input type="number" min={0} max={Number(i.quantity)-Number(i.receivedQty||0)} step="0.001" className="w-28 rounded-lg border p-2 text-right" value={qtys[i.id] ?? 0} onChange={(e)=>setQtys({...qtys,[i.id]:Number(e.target.value)})} /></td></tr>)}
                {pending.length===0 && <tr><td colSpan={3} className="p-4 text-center text-[#708195]">Sem quantidades pendentes.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowReceive(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={saving || !warehouseId || pending.length===0} className="rounded-lg bg-[#267256] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'A registará' : 'Confirmar receção'}</button></div>
        </form>
      )}
    </div>
  );
}
