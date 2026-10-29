'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { DesktopStatus } from '../../electron/ipc-contract';
import type { OfflineDraft } from '../../electron/offline-store';

type Snapshot = { profile?: { name?: string; nif?: string }; customers?: Array<{ id: string; name: string; nif?: string | null }>; products?: Array<{ id: string; name: string; price: number | string }> };
type Item = { desc: string; qty: number; rate: number; productId: string | null };

const blank = () => ({ id: '', customerName: '', customerNif: '', desc: '', qty: '1', rate: '0', observations: '' });

export function OfflineWorkspace() {
  const desktop = typeof window === 'undefined' ? undefined : window.machineFacturasDesktop;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const readOnly = !status?.configured || status.readOnly;

  const load = useCallback(async () => {
    if (!desktop) return;
    try {
      const [currentStatus, cache, localDrafts] = await Promise.all([desktop.getStatus(), desktop.readSnapshot(), desktop.listDrafts()]);
      setStatus(currentStatus);
      setSnapshot(cache as Snapshot | null);
      setDrafts(localDrafts);
    } catch { setMessage('Não foi possível abrir os dados offline neste dispositivo.'); }
  }, [desktop]);

  useEffect(() => { void load(); }, [load]);
  const pending = useMemo(() => drafts.filter((draft) => draft.syncState !== 'SYNCED'), [drafts]);

  function edit(draft: OfflineDraft) {
    if (draft.syncState === 'SYNCED') return;
    const item = Array.isArray(draft.items) ? draft.items[0] as Item | undefined : undefined;
    setForm({ id: draft.id, customerName: String(draft.customerName ?? ''), customerNif: String(draft.customerNif ?? ''), desc: item?.desc ?? '', qty: String(item?.qty ?? 1), rate: String(item?.rate ?? 0), observations: String(draft.observations ?? '') });
    setMessage('A editar um rascunho local.');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!desktop || readOnly) return;
    const customerName = form.customerName.trim();
    const desc = form.desc.trim();
    const qty = Number(form.qty);
    const rate = Number(form.rate);
    if (!customerName || !desc || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) {
      setMessage('Indique cliente, descrição, quantidade e preço válidos.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const id = form.id || crypto.randomUUID();
      const existing = drafts.find((draft) => draft.id === id);
      await desktop.saveDraft({
        id, customerName, customerNif: form.customerNif.trim() || null,
        items: [{ desc, qty, rate, productId: null }], applyVat: true,
        discountType: 'amount', discountValue: 0, observations: form.observations.trim() || null,
        includeCompanyProfile: true, currency: 'AOA', dueAt: null, companyBankAccountId: null,
      });
      setForm(blank());
      setMessage(existing ? 'Rascunho local actualizado.' : 'Rascunho local guardado. Ainda não é uma factura emitida.');
      await load();
    } catch { setMessage('Não foi possível guardar. A autorização pode ter expirado; ligue-se para a renovar.'); }
    finally { setBusy(false); }
  }

  async function sync() {
    if (!desktop) return;
    setBusy(true);
    try {
      const result = await desktop.syncPendingDrafts();
      setMessage(`${result.synced} sincronizado(s), ${result.pending} pendente(s), ${result.conflicts} conflito(s).`);
      await load();
    } catch { setMessage('A sincronização não está disponível. Os rascunhos permanecem guardados neste dispositivo.'); }
    finally { setBusy(false); }
  }

  return <main className="offline-page">
    <div className="offline-wrap">
      <header className="offline-header">
        <div><span className="offline-kicker">MACHINE FACTURAS</span><h1>Área offline</h1><p>Consulte a cópia autorizada e prepare rascunhos enquanto não tem ligação.</p></div>
        <span className={`offline-pill ${readOnly ? 'muted' : 'ready'}`}>{readOnly ? 'Só leitura' : 'Dados protegidos'}</span>
      </header>
      {!desktop && <div className="offline-alert">Esta página só funciona na aplicação desktop Machine Facturas.</div>}
      {status?.configured && <div className="offline-status" aria-live="polite">
        <span>{status.online ? 'Ligação disponível' : 'Sem ligação à Internet'}</span>
        <span>{pending.length} rascunho(s) por sincronizar</span>
        {status.expiresAt && <span>Autorização válida até {new Date(status.expiresAt * 1000).toLocaleString('pt-AO')}</span>}
      </div>}
      {!status?.configured && <div className="offline-alert"><strong>Primeira utilização</strong><br />Ligue-se à aplicação online e inicie sessão para preparar uma cópia offline autorizada.</div>}
      {message && <p className="offline-message" role="status">{message}</p>}

      <section className="offline-card">
        <div className="offline-card-head"><div><h2>Rascunhos de factura</h2><p>Os rascunhos offline só ficam definitivos depois de sincronizados e validados online.</p></div><button type="button" className="offline-secondary" onClick={() => void sync()} disabled={busy || !status?.online || !pending.length}>Sincronizar</button></div>
        <form onSubmit={save} className="offline-form">
          <label>Cliente<input autoComplete="off" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} disabled={readOnly || busy} /></label>
          <label>NIF do cliente <span>(opcional)</span><input autoComplete="off" value={form.customerNif} onChange={(event) => setForm({ ...form, customerNif: event.target.value })} disabled={readOnly || busy} /></label>
          <label className="wide">Descrição do artigo<input autoComplete="off" value={form.desc} onChange={(event) => setForm({ ...form, desc: event.target.value })} disabled={readOnly || busy} /></label>
          <label>Quantidade<input inputMode="decimal" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} disabled={readOnly || busy} /></label>
          <label>Preço unitário (Kz)<input inputMode="decimal" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} disabled={readOnly || busy} /></label>
          <label className="wide">Observações <span>(opcional)</span><textarea rows={2} value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} disabled={readOnly || busy} /></label>
          <div className="offline-form-actions"><button className="offline-primary" type="submit" disabled={readOnly || busy}>{busy ? 'A guardar…' : form.id ? 'Actualizar rascunho' : 'Guardar rascunho'}</button>{form.id && <button type="button" className="offline-secondary" onClick={() => setForm(blank())}>Cancelar</button>}</div>
        </form>
        {drafts.length > 0 && <ul className="offline-drafts">{drafts.map((draft) => <li key={draft.id}>
          <div><strong>{String(draft.customerName || 'Sem cliente')}</strong><span>{Array.isArray(draft.items) ? (draft.items[0] as Item | undefined)?.desc : ''}</span></div>
          <span className={`draft-state ${String(draft.syncState ?? 'PENDING').toLowerCase()}`}>{draft.syncState === 'SYNCED' ? 'Sincronizado' : draft.syncState === 'CONFLICT' ? 'Conflito' : draft.syncState === 'ERROR' ? 'Erro — tentar novamente' : draft.syncState === 'SYNCING' ? 'A sincronizar' : 'Pendente'}</span>
          {draft.syncState !== 'SYNCED' && <button className="offline-text-button" type="button" onClick={() => edit(draft)} disabled={readOnly || busy}>Editar</button>}
        </li>)}</ul>}
        {drafts.length === 0 && status?.configured && <p className="offline-empty">Ainda não existem rascunhos guardados neste dispositivo.</p>}
      </section>

      <section className="offline-card">
        <div className="offline-card-head"><div><h2>Dados disponíveis offline</h2><p>Cópia da conta e do catálogo autorizados na última ligação.</p></div><button type="button" className="offline-secondary" onClick={() => void desktop?.connectOnline()}>Ligar à aplicação</button></div>
        {snapshot?.profile && <p className="offline-company"><strong>{snapshot.profile.name ?? 'Empresa'}</strong>{snapshot.profile.nif ? ` · NIF ${snapshot.profile.nif}` : ''}</p>}
        <div className="offline-lists">
          <div><h3>Clientes ({snapshot?.customers?.length ?? 0})</h3><ul>{snapshot?.customers?.slice(0, 20).map((customer) => <li key={customer.id}>{customer.name}{customer.nif ? <small>{customer.nif}</small> : null}</li>)}</ul></div>
          <div><h3>Produtos ({snapshot?.products?.length ?? 0})</h3><ul>{snapshot?.products?.slice(0, 20).map((product) => <li key={product.id}>{product.name}<small>{Number(product.price).toLocaleString('pt-AO')} Kz</small></li>)}</ul></div>
        </div>
      </section>
      <footer className="offline-footer">Os rascunhos offline não são facturas fiscais emitidas. A emissão exige validação e ligação ao servidor.</footer>
    </div>
  </main>;
}
