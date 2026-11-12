'use client';

import { useEffect, useState } from 'react';
import { FormField } from '@/components/rh/form-kit';

type Supplier = { id: string; name: string; nif: string | null; email: string | null; phone: string | null; contact?: string | null; address?: string | null };

export function SuppliersClient() {
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/stock/suppliers');
      if (!response.ok) throw new Error('Não foi possível carregar fornecedores.');
      setSuppliers(await response.json());
    } catch (exception: any) { setError(exception.message); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setInfo('');
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      nif: String(form.get('nif') ?? '').trim() || undefined,
      contact: String(form.get('contact') ?? '').trim() || undefined,
      address: String(form.get('address') ?? '').trim() || undefined,
      email: String(form.get('email') ?? '').trim() || undefined,
      phone: String(form.get('phone') ?? '').trim() || undefined,
    };
    if (!payload.name) { setError('Nome do fornecedor é obrigatório.'); setBusy(false); return; }
    try {
      const response = await fetch('/api/stock/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data?.error ?? 'Não foi possível criar o fornecedor.'); setBusy(false); return; }
      event.currentTarget.reset();
      setSuppliers((current) => [...current, { id: data.id, name: data.name, nif: data.nif ?? null, email: data.email ?? null, phone: data.phone ?? null }]);
      setInfo(`Fornecedor "${data.name}" criado.`);
    } catch (exception: any) { setError(exception.message); } finally { setBusy(false); }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setInfo('');
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      nif: String(form.get('nif') ?? '').trim() || undefined,
      contact: String(form.get('contact') ?? '').trim() || undefined,
      address: String(form.get('address') ?? '').trim() || undefined,
      email: String(form.get('email') ?? '').trim() || undefined,
      phone: String(form.get('phone') ?? '').trim() || undefined,
    };
    try {
      const response = await fetch(`/api/stock/suppliers/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data?.error ?? 'Não foi possível editar o fornecedor.'); setBusy(false); return; }
      setSuppliers((current) => current.map((s) => s.id === editing.id ? { ...s, ...data } : s));
      setEditing(null); setInfo('Fornecedor actualizado.');
    } catch (exception: any) { setError(exception?.message ?? 'Erro inesperado.'); } finally { setBusy(false); }
  }

  async function deleteSupplier(supplier: Supplier) {
    if (!window.confirm(`Remover o fornecedor «${supplier.name}»? Esta acção não pode ser anulada.`)) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const response = await fetch(`/api/stock/suppliers/${supplier.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data?.error ?? 'Não foi possível eliminar o fornecedor.'); setBusy(false); return; }
      setSuppliers((current) => current.filter((s) => s.id !== supplier.id));
      setInfo('Fornecedor eliminado.');
    } catch (exception: any) { setError(exception?.message ?? 'Erro inesperado.'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8a99ab]">Stock</p>
        <h1 className="mt-1 text-3xl font-bold text-[#1c2d3f]">Fornecedores</h1>
        <p className="mt-2 text-sm text-[#708195]">Gestão de fornecedores. O plano da empresa define o número máximo de fornecedores.</p>
      </div>
      <p className="text-xs text-[#52667a]">A criação de fornecedores é limitada pelo pacote comercial. Dados nunca são apagados ao atingir o limite.</p>
      <section className="rounded-xl border border-[#e3e9ef] bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#1c2d3f]">Novo fornecedor</h2>
        <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><FormField label="Nome *" name="name" required><input id="supplier-name" name="name" required className="app-input" placeholder="Ex.: Fornecedor Industrial Lda" maxLength={200} /></FormField></div>
          <div><FormField label="NIF" name="nif"><input id="supplier-nif" name="nif" className="app-input" placeholder="000.000.000" maxLength={50} /></FormField></div>
          <div><FormField label="Email" name="email"><input id="supplier-email" name="email" type="email" className="app-input" placeholder="compras@empresa.co.ao" maxLength={200} /></FormField></div>
          <div><FormField label="Telefone" name="phone"><input id="supplier-phone" name="phone" className="app-input" placeholder="+244 923 000 000" maxLength={30} /></FormField></div>
          <div><FormField label="Contacto" name="contact"><input id="supplier-contact" name="contact" className="app-input" placeholder="Pessoa de contacto" maxLength={200} /></FormField></div>
          <div className="sm:col-span-2"><FormField label="Morada" name="address"><input id="supplier-address" name="address" className="app-input" placeholder="Endereço" maxLength={300} /></FormField></div>
          {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-[#fdf3f3] px-3 py-2 text-sm text-[#a83939]">{error}</p>}
          {info && <p role="status" className="sm:col-span-2 rounded-lg bg-[#effaf4] px-3 py-2 text-sm text-[#1f6d3d]">{info}</p>}
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className="rounded-lg bg-[#021f87] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'A criar…' : 'Adicionar fornecedor'}</button></div>
        </form>
      </section>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveEdit} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-[#1c2d3f]">Editar fornecedor</h2>
            <div className="mt-3 grid gap-3">
              <FormField label="Nome *" name="name" required><input name="name" defaultValue={editing.name} required className="app-input" maxLength={200} /></FormField>
              <FormField label="NIF" name="nif"><input name="nif" defaultValue={editing.nif ?? ''} className="app-input" maxLength={50} /></FormField>
              <FormField label="Email" name="email"><input name="email" defaultValue={editing.email ?? ''} className="app-input" maxLength={200} /></FormField>
              <FormField label="Telefone" name="phone"><input name="phone" defaultValue={editing.phone ?? ''} className="app-input" maxLength={30} /></FormField>
              <FormField label="Contacto" name="contact"><input name="contact" defaultValue={editing.contact ?? ''} className="app-input" maxLength={200} /></FormField>
              <FormField label="Morada" name="address"><input name="address" defaultValue={editing.address ?? ''} className="app-input" maxLength={300} /></FormField>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-[#e1e8f0] px-4 py-2 text-sm">Cancelar</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-[#021f87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'A guardar…' : 'Guardar alterações'}</button>
            </div>
          </form>
        </div>
      )}

      <section><h2 className="text-base font-semibold text-[#1c2d3f]">Fornecedores registados ({suppliers.length})</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-[#e3e9ef] bg-white"><div className="overflow-x-auto">
        <table className="data-table min-w-[760px]"><thead><tr><th>Nome</th><th>NIF</th><th>Email</th><th>Telefone</th><th>Acções</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="p-6 text-center text-[#708195]">A carregar…</td></tr> : suppliers.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-[#708195]">Sem fornecedores.</td></tr> : suppliers.map((s) => <tr key={s.id}><td className="font-semibold text-[#1c2d3f]">{s.name}</td><td>{s.nif ?? '—'}</td><td>{s.email ?? '—'}</td><td>{s.phone ?? '—'}</td><td className="whitespace-nowrap"><button type="button" onClick={() => setEditing(s)} className="text-xs font-semibold text-[#021f87] hover:underline">Editar</button><button type="button" onClick={() => deleteSupplier(s)} className="ml-3 text-xs font-semibold text-[#a83939] hover:underline">Eliminar</button></td></tr>)}</tbody></table>
      </div></div></section>
    </div>
  );
}
