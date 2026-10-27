'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { BUSINESS_DOCUMENT_LABELS } from '@/lib/business-document-labels';
import { BUSINESS_DOCUMENT_TYPES, calculateBusinessDocumentTotals, type BusinessDocumentInput, type BusinessDocumentItemInput, type BusinessDocumentType } from '@/lib/business-document-core';

type Customer = { id: string; name: string; nif: string | null; address: string | null };
type Product = { id: string; name: string; code: string | null; price: number; taxRate: number };
type InitialDocument = BusinessDocumentInput & { id: string; customerSnapshot?: { name?: string; nif?: string | null; address?: string | null } | null };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const newItem = (): BusinessDocumentItemInput => ({ description: '', quantity: 1, unitPrice: 0, taxRate: 0, productId: null });

export function BusinessDocumentForm({ customers, products, initialType, initialDocument }: { customers: Customer[]; products: Product[]; initialType: BusinessDocumentType; initialDocument?: InitialDocument | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<BusinessDocumentType>(initialDocument?.type ?? initialType);
  const [title, setTitle] = useState(initialDocument?.title ?? '');
  const [customerId, setCustomerId] = useState(initialDocument?.customerId ?? '');
  const [counterpartyName, setCounterpartyName] = useState(initialDocument?.customerSnapshot?.name as string ?? '');
  const [counterpartyNif, setCounterpartyNif] = useState(initialDocument?.customerSnapshot?.nif as string ?? '');
  const [counterpartyAddress, setCounterpartyAddress] = useState(initialDocument?.customerSnapshot?.address as string ?? '');
  const [issueDate, setIssueDate] = useState(initialDocument?.issueDate ?? today());
  const [validUntil, setValidUntil] = useState(initialDocument?.validUntil ?? '');
  const [details, setDetails] = useState(initialDocument?.details ?? '');
  const [notes, setNotes] = useState(initialDocument?.notes ?? '');
  const [items, setItems] = useState<BusinessDocumentItemInput[]>(initialDocument?.items?.length ? initialDocument.items : []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => calculateBusinessDocumentTotals(items), [items]);
  const requiresItems = ['PROPOSAL', 'QUOTE', 'PROFORMA', 'PURCHASE_ORDER', 'DELIVERY_NOTE'].includes(type);
  const hasRecipient = Boolean(customerId || counterpartyName.trim());

  function updateItem(index: number, changes: Partial<BusinessDocumentItemInput>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  function chooseCustomer(id: string) {
    setCustomerId(id);
    const customer = customers.find((item) => item.id === id);
    setCounterpartyName(customer?.name ?? '');
    setCounterpartyNif(customer?.nif ?? '');
    setCounterpartyAddress(customer?.address ?? '');
  }

  function chooseProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateItem(index, product ? { productId, description: product.name, unitPrice: product.price, taxRate: product.taxRate } : { productId: null });
  }

  async function save(status: 'DRAFT' | 'ISSUED') {
    setError('');
    if (!title.trim()) { setError('Indique o título do documento.'); return; }
    if (requiresItems && !items.length) { setError('Adicione pelo menos uma linha ao documento.'); return; }
    if (requiresItems && !hasRecipient) { setError('Seleccione um cliente ou indique o destinatário.'); return; }
    if (['SERVICE_ORDER', 'SERVICE_CONTRACT', 'COMPANY_DECLARATION'].includes(type) && !details.trim()) { setError('Descreva os termos ou o conteúdo do documento.'); return; }
    setSaving(true);
    try {
      const input: BusinessDocumentInput = {
        type, title, customerId: customerId || null,
        counterpartyName: counterpartyName.trim() || null,
        counterpartyNif: counterpartyNif.trim() || null,
        counterpartyAddress: counterpartyAddress.trim() || null,
        issueDate, validUntil: validUntil || null, currency: 'AOA', details: details.trim() || null,
        notes: notes.trim() || null, items,
      };
      const response = await fetch(initialDocument ? `/api/business-documents/${initialDocument.id}` : '/api/business-documents', {
        method: initialDocument ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) { setError(result?.error ?? 'Não foi possível guardar o documento.'); return; }
      const documentId = result?.document?.id ?? initialDocument?.id;
      if (status === 'ISSUED' && documentId) {
        const issued = await fetch(`/api/business-documents/${documentId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ISSUED' }) });
        const issueResult = await issued.json().catch(() => null);
        if (!issued.ok) { setError(issueResult?.error ?? 'O rascunho foi guardado, mas não foi possível emiti-lo.'); router.push(`/documentos/${documentId}`); return; }
      }
      if (documentId) router.push(`/documentos/${documentId}`);
      else router.push('/documentos');
      startTransition(() => router.refresh());
    } catch {
      setError('Não foi possível comunicar com o servidor. Tente novamente.');
    } finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-[#708195]">Documentos Empresariais</p><h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">{initialDocument ? 'Editar rascunho' : 'Novo documento'}</h2><p className="mt-2 text-sm text-[#708195]">Os documentos emitidos ficam bloqueados para edição e mantêm o histórico de alterações.</p></div>
      <Link href="/documentos" className="inline-flex min-h-10 items-center rounded-lg border border-[#d8e1eb] bg-white px-4 text-sm font-semibold text-[#344256]">Voltar à lista</Link>
    </div>

    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-sm md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="app-label" htmlFor="document-type">Tipo de documento</label><select id="document-type" className="app-input" value={type} disabled={Boolean(initialDocument)} onChange={(event) => setType(event.target.value as BusinessDocumentType)}>{BUSINESS_DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{BUSINESS_DOCUMENT_LABELS[value]}</option>)}</select></div>
        <div><label className="app-label" htmlFor="document-title">Título</label><input id="document-title" className="app-input" maxLength={160} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={BUSINESS_DOCUMENT_LABELS[type]} /></div>
        <div><label className="app-label" htmlFor="document-date">Data de emissão</label><input id="document-date" type="date" className="app-input" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></div>
        <div><label className="app-label" htmlFor="document-validity">Validade (quando aplicável)</label><input id="document-validity" type="date" className="app-input" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></div>
      </div>
    </section>

    {requiresItems && <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-sm md:p-6">
      <h3 className="font-bold text-[#1c2d3f]">Cliente ou destinatário</h3>
      <p className="mt-1 text-xs leading-5 text-[#708195]">Use um cliente registado ou indique os dados sem criar um registo duplicado.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div><label className="app-label" htmlFor="document-customer">Cliente registado</label><select id="document-customer" className="app-input" value={customerId} onChange={(event) => chooseCustomer(event.target.value)}><option value="">Outro destinatário</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.nif ? ` · ${customer.nif}` : ''}</option>)}</select></div>
        <div><label className="app-label" htmlFor="counterparty-name">Nome do cliente/fornecedor *</label><input id="counterparty-name" className="app-input" maxLength={160} required={!customerId} disabled={Boolean(customerId)} value={counterpartyName} onChange={(event) => { setCustomerId(''); setCounterpartyName(event.target.value); }} /></div>
        <div><label className="app-label" htmlFor="counterparty-nif">NIF (opcional)</label><input id="counterparty-nif" className="app-input" maxLength={40} disabled={Boolean(customerId)} value={counterpartyNif} onChange={(event) => { setCustomerId(''); setCounterpartyNif(event.target.value); }} /></div>
        <div><label className="app-label" htmlFor="counterparty-address">Morada (opcional)</label><input id="counterparty-address" className="app-input" maxLength={240} disabled={Boolean(customerId)} value={counterpartyAddress} onChange={(event) => { setCustomerId(''); setCounterpartyAddress(event.target.value); }} /></div>
      </div>
    </section>}

    {type !== 'COMPANY_DECLARATION' && <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-[#1c2d3f]">Linhas do documento</h3><p className="mt-1 text-xs text-[#708195]">As taxas são indicativas e não atribuem natureza fiscal ao documento.</p></div><button type="button" onClick={() => setItems((current) => [...current, newItem()])} className="inline-flex min-h-10 items-center rounded-lg border border-[#cdddeb] bg-white px-3 text-sm font-semibold text-[#2878d0]">+ Adicionar linha</button></div>
      <div className="mt-4 space-y-3">{items.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-[#edf1f5] p-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_90px_120px_95px_auto] lg:items-end">
        <div className="sm:col-span-2 lg:col-span-1"><label className="app-label" htmlFor={`product-${index}`}>Produto/serviço registado</label><select id={`product-${index}`} className="app-input" value={item.productId ?? ''} onChange={(event) => chooseProduct(index, event.target.value)}><option value="">Descrição livre</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.code ? ` · ${product.code}` : ''}</option>)}</select></div>
        <div className="sm:col-span-2 lg:col-span-1"><label className="app-label" htmlFor={`description-${index}`}>Descrição *</label><input id={`description-${index}`} className="app-input" maxLength={240} value={item.description} onChange={(event) => updateItem(index, { description: event.target.value, productId: null })} /></div>
        <div><label className="app-label" htmlFor={`quantity-${index}`}>Quantidade</label><input id={`quantity-${index}`} type="number" min="0.001" step="0.001" className="app-input tabular-nums" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></div>
        <div><label className="app-label" htmlFor={`unit-price-${index}`}>Preço unitário</label><input id={`unit-price-${index}`} type="number" min="0" step="0.01" className="app-input tabular-nums" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} /></div>
        <div><label className="app-label" htmlFor={`tax-rate-${index}`}>Taxa %*</label><input id={`tax-rate-${index}`} type="number" min="0" max="100" step="0.01" className="app-input tabular-nums" value={item.taxRate} onChange={(event) => updateItem(index, { taxRate: Number(event.target.value) })} /></div>
        <button type="button" aria-label={`Remover linha ${index + 1}`} disabled={requiresItems && items.length <= 1} onClick={() => setItems((current) => current.filter((_, row) => row !== index))} className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-40">Remover</button>
      </div>)}</div>
      {items.length > 0 && <div className="mt-5 ml-auto max-w-xs space-y-2 border-t border-[#e2e9f1] pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{totals.subTotal.toLocaleString('pt-AO')} AOA</span></div><div className="flex justify-between"><span>Impostos indicativos</span><span className="tabular-nums">{totals.taxTotal.toLocaleString('pt-AO')} AOA</span></div><div className="flex justify-between font-bold"><span>Total</span><span className="tabular-nums">{totals.total.toLocaleString('pt-AO')} AOA</span></div></div>}
    </section>}

    {['SERVICE_ORDER', 'SERVICE_CONTRACT', 'COMPANY_DECLARATION'].includes(type) && <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-sm md:p-6"><label className="app-label" htmlFor="document-details">Termos ou conteúdo do documento *</label><textarea id="document-details" className="app-input min-h-40" maxLength={12000} value={details} onChange={(event) => setDetails(event.target.value)} /></section>}
    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-sm md:p-6"><label className="app-label" htmlFor="document-notes">Observações (opcional)</label><textarea id="document-notes" className="app-input min-h-24" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></section>

    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Estes documentos são comerciais ou operacionais. Não substituem uma factura fiscal. As notas de crédito e débito fiscais continuam no fluxo próprio de correcção de facturas.</p>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={saving || pending} onClick={() => save('DRAFT')} className="min-h-11 rounded-lg border border-[#cdddeb] bg-white px-5 text-sm font-semibold text-[#344256] disabled:opacity-50">{saving ? 'A guardar…' : 'Guardar rascunho'}</button><button type="button" disabled={saving || pending} onClick={() => save('ISSUED')} className="min-h-11 rounded-lg bg-[#021F87] px-5 text-sm font-semibold text-white disabled:opacity-50">Guardar e emitir</button></div>
  </div>;
}
