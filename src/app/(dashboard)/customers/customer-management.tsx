'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Customer = { id: string; name: string; nif: string | null; email: string | null; address: string | null };

export function CustomerManagement({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function openCreate() {
    setEditing(null);
    setError('');
    setNotice('');
    setIsOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setError('');
    setNotice('');
    setIsOpen(true);
  }

  async function handleDelete(customer: Customer) {
    if (!window.confirm(`Apagar o cliente "${customer.name}"? Esta acção não pode ser revertida.`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível apagar o cliente.');
        return;
      }
      setCustomers((current) => current.filter((entry) => entry.id !== customer.id));
      setNotice('Cliente apagado.');
    } catch {
      setError('Não foi possível comunicar com o servidor. Tente novamente.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    setIsSaving(true);

    const form = new FormData(formElement);
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      nif: String(form.get('nif') ?? '').trim() || null,
      email: String(form.get('email') ?? '').trim() || null,
      address: String(form.get('address') ?? '').trim() || null,
    };

    try {
      const editingCustomer = editing;
      const response = await fetch(editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers', {
        method: editingCustomer ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível guardar o cliente. Tente novamente.');
        return;
      }

      setCustomers((current) => editingCustomer
        ? current.map((entry) => (entry.id === editingCustomer.id ? data : entry))
        : [...current, data]);
      setNotice(editingCustomer ? 'Cliente actualizado com sucesso.' : 'Cliente criado com sucesso.');
      setIsOpen(false);
      setEditing(null);
      formElement.reset();
    } catch {
      setError('Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-sm text-[#708195]">Directório da empresa</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Clientes</h2></div>
        <Button type="button" onClick={openCreate}>Novo Cliente</Button>
      </div>

      {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm font-medium text-[#267256]">{notice}</p>}
      {error && !isOpen && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Listagem de clientes <span className="ml-2 rounded-full bg-[#eff4f8] px-2 py-1 align-middle text-xs font-semibold text-[#617488]">{customers.length}</span></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {customers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center"><p className="font-semibold text-[#344a60]">Nenhum cliente cadastrado.</p><p className="mt-1 text-sm text-[#708195]">Use “Novo Cliente” para registar o primeiro cliente.</p></div>
            ) : (
              customers.map((customer) => (
                <div key={customer.id} className="flex flex-col justify-between gap-2 border-b border-[#e7edf3] py-4 last:border-0 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <span className="font-semibold text-[#263c52]">{customer.name}</span>
                    <span className="ml-3 text-sm text-[#708195]">NIF: {customer.nif || 'Sem NIF'}</span>
                    {customer.email && <span className="ml-3 hidden text-sm text-[#708195] lg:inline">{customer.email}</span>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => openEdit(customer)} className="rounded-lg border border-[#cdddeb] px-3 py-1.5 text-sm font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]">Editar</button>
                    <button type="button" onClick={() => handleDelete(customer)} className="rounded-lg border border-[#f0d3d3] px-3 py-1.5 text-sm font-semibold text-[#a83939] transition hover:bg-[#fdf3f3]">Apagar</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {isOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="customer-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Directório da empresa</p><h3 id="customer-form-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">{editing ? 'Editar cliente' : 'Novo cliente'}</h3><p className="mt-1 text-sm text-[#708195]">Preencha os dados do cliente.</p></div>
            <button type="button" aria-label="Fechar" disabled={isSaving} onClick={() => setIsOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit} key={editing?.id ?? 'novo'}>
            <div><label htmlFor="customer-name" className="app-label">Nome do cliente <span className="text-[#c44747]">*</span></label><input id="customer-name" name="name" className="app-input" autoComplete="name" maxLength={160} required autoFocus defaultValue={editing?.name ?? ''} /></div>
            <div><label htmlFor="customer-nif" className="app-label">NIF <span className="font-normal text-[#708195]">(opcional)</span></label><input id="customer-nif" name="nif" className="app-input" inputMode="numeric" defaultValue={editing?.nif ?? ''} /></div>
            <div><label htmlFor="customer-email" className="app-label">Email</label><input id="customer-email" name="email" type="email" className="app-input" autoComplete="email" defaultValue={editing?.email ?? ''} /></div>
            <div><label htmlFor="customer-address" className="app-label">Morada</label><input id="customer-address" name="address" className="app-input" autoComplete="street-address" defaultValue={editing?.address ?? ''} /></div>
            {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'A guardar…' : editing ? 'Guardar alterações' : 'Guardar cliente'}</Button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}
