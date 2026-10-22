'use client';

import { useState, type FormEvent } from 'react';

type Account = { id: string; bankName: string; accountHolder: string | null; iban: string | null; currency: string; label: string | null; isActive: boolean; isPrimary: boolean };
const empty = { bankName: '', accountHolder: '', iban: '', currency: 'AOA', label: '', isActive: true, isPrimary: false };

export function BankAccountManager({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function edit(account: Account) {
    setEditingId(account.id);
    setForm({ bankName: account.bankName, accountHolder: account.accountHolder ?? '', iban: account.iban ?? '', currency: 'AOA', label: account.label ?? '', isActive: account.isActive, isPrimary: account.isPrimary });
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(editingId ? `/api/company-profile/bank-accounts/${editingId}` : '/api/company-profile/bank-accounts', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.bankAccount) { setError(data?.error ?? 'Não foi possível guardar a conta.'); return; }
      const account = data.bankAccount as Account;
      setAccounts((current) => [...current.filter((item) => item.id !== account.id).map((item) => account.isPrimary ? { ...item, isPrimary: false } : item), account].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)));
      setForm(empty); setEditingId(null); setMessage('Conta bancária guardada.');
    } catch { setError('Não foi possível comunicar com o servidor.'); }
    finally { setBusy(false); }
  }

  async function deactivate(account: Account) {
    if (!window.confirm(`Desactivar a conta ${account.label || account.bankName}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/company-profile/bank-accounts/${account.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...account, isActive: false, isPrimary: false }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Não foi possível desactivar a conta.'); return; }
      setAccounts((current) => current.map((item) => item.id === account.id ? data.bankAccount : item)); setMessage('Conta desactivada. O histórico das facturas emitidas foi preservado.');
    } catch { setError('Não foi possível comunicar com o servidor.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5 rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-6">
    <div><h3 className="font-bold text-[#1c2d3f]">Contas bancárias</h3><p className="mt-1 text-sm text-[#708195]">Escolha a conta a apresentar em cada factura. Dados guardados no documento ficam congelados no histórico.</p></div>
    {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {accounts.length > 0 && <ul className="divide-y divide-[#edf1f5]">{accounts.map((account) => <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-[#263c52]">{account.label || account.bankName}{account.isPrimary ? <span className="ml-2 rounded-full bg-[#e8f4fc] px-2 py-0.5 text-[10px] font-bold text-[#2878d0]">Principal</span> : null}{!account.isActive && <span className="ml-2 text-xs text-[#708195]">Inactiva</span>}</p><p className="mt-1 text-xs text-[#708195]">{account.bankName}{account.accountHolder ? ` · ${account.accountHolder}` : ''}{account.iban ? ` · ${account.iban}` : ''}</p></div><div className="flex gap-2"><button type="button" onClick={() => edit(account)} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#2878d0]">Editar</button>{account.isActive && <button type="button" disabled={busy} onClick={() => deactivate(account)} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Desactivar</button>}</div></li>)}</ul>}
    <form onSubmit={save} className="grid gap-3 rounded-xl bg-[#f7f9fc] p-4 sm:grid-cols-2">
      <div><label htmlFor="account-bank" className="app-label">Banco *</label><input id="account-bank" className="app-input" required maxLength={120} value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></div>
      <div><label htmlFor="account-label" className="app-label">Nome/rótulo</label><input id="account-label" className="app-input" maxLength={80} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></div>
      <div><label htmlFor="account-holder" className="app-label">Titular</label><input id="account-holder" className="app-input" maxLength={160} value={form.accountHolder} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} /></div>
      <div><label htmlFor="account-iban" className="app-label">IBAN</label><input id="account-iban" className="app-input" maxLength={34} value={form.iban} onChange={(event) => setForm({ ...form, iban: event.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm text-[#30465c]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked, isPrimary: event.target.checked && form.isPrimary })} />Activa</label>
      <label className="flex items-center gap-2 text-sm text-[#30465c]"><input type="checkbox" checked={form.isPrimary} disabled={!form.isActive} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} />Definir como principal</label>
      <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="min-h-10 rounded-lg bg-[#2878d0] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Adicionar conta'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(empty); }} className="min-h-10 rounded-lg border border-[#d8e1eb] px-4 text-sm font-semibold text-[#607286]">Cancelar edição</button>}</div>
    </form>
  </section>;
}
