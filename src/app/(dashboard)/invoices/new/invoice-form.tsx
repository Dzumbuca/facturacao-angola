'use client';

import { useMemo, useTransition, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { getInvoiceApiErrorMessage } from '@/lib/invoice-api-error';
import { createInvoiceShare } from '@/lib/invoice-share';
import { CheckIcon, WhatsappIcon } from '@/components/icons';

type Customer = { id: string; name: string; nif: string | null };
type Product = { id: string; codigo: string | null; name: string; price: number; stock: number; categoria: string };
type InvoiceItem = { desc: string; qty: number; rate: number; productId: string | null };
type DraftItem = InvoiceItem;
type InitialDraft = { id?: string; customerName: string; customerNif: string | null; items: DraftItem[]; applyVat: boolean; discountType: string; discountValue: number; observations: string | null; includeCompanyProfile: boolean; dueAt: string; companyBankAccountId: string | null };
type BankAccount = { id: string; bankName: string; label: string | null };

export function InvoiceForm({ initialCustomers, initialProducts, hasCompanyProfile, bankAccounts = [], initialDraft, initialDueAt = '', defaultObservations = '' }: { initialCustomers: Customer[]; initialProducts: Product[]; hasCompanyProfile: boolean; bankAccounts?: BankAccount[]; initialDraft?: InitialDraft; initialDueAt?: string; defaultObservations?: string }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [products, setProducts] = useState(initialProducts);
  const [customerName, setCustomerName] = useState(initialDraft?.customerName ?? '');
  const [customerNif, setCustomerNif] = useState(initialDraft?.customerNif ?? '');
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>(initialDraft?.items.length ? initialDraft.items : [{ desc: '', qty: 1, rate: 0, productId: null }]);
  const [applyVat, setApplyVat] = useState(initialDraft?.applyVat ?? true);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(initialDraft?.discountType === 'percent' ? 'percent' : 'amount');
  const [discountValue, setDiscountValue] = useState(initialDraft?.discountValue ?? 0);
  const [observations, setObservations] = useState(initialDraft?.observations ?? defaultObservations);
  const [includeCompanyProfile, setIncludeCompanyProfile] = useState(initialDraft?.includeCompanyProfile ?? true);
  const [dueAt, setDueAt] = useState(initialDraft?.dueAt ?? initialDueAt);
  const [companyBankAccountId, setCompanyBankAccountId] = useState(initialDraft?.companyBankAccountId ?? '');
  const [draftId, setDraftId] = useState(initialDraft?.id ?? null);
  const [draftSaved, setDraftSaved] = useState('');
  const [emitted, setEmitted] = useState<{ id: string; number: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);
  const [activeProductIndex, setActiveProductIndex] = useState<number | null>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingProductFor, setCreatingProductFor] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [customerCreateError, setCustomerCreateError] = useState('');
  const [productCreateError, setProductCreateError] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const subtotal = items.reduce((acc, item) => acc + item.qty * item.rate, 0);
  const discountAmount = Math.min(subtotal, discountType === 'percent' ? subtotal * Math.min(100, Math.max(0, discountValue)) / 100 : Math.max(0, discountValue));
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const tax = applyVat ? taxableBase * 0.14 : 0;
  const total = taxableBase + tax;
  const matchingCustomers = useMemo(() => {
    const query = customerName.trim().toLocaleLowerCase();
    return customers.filter((customer) => !query || customer.name.toLocaleLowerCase().includes(query) || (customer.nif ?? '').includes(query)).slice(0, 6);
  }, [customerName, customers]);

  const addItem = () => setItems((current) => [...current, { desc: '', qty: 1, rate: 0, productId: null }]);
  const removeItem = (index: number) => setItems((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  const validItems = items.filter((item) => item.desc.trim() !== '');

  function selectCustomer(customer: Customer) {
    setCustomerName(customer.name);
    setCustomerNif(customer.nif ?? '');
    setCustomerSuggestionsOpen(false);
  }

  function updateItem(index: number, changes: Partial<InvoiceItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  function selectProduct(index: number, product: Product) {
    updateItem(index, { desc: product.name, rate: product.price, productId: product.id });
    setActiveProductIndex(null);
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      nif: String(formData.get('nif') ?? '').trim() || null,
      email: String(formData.get('email') ?? '').trim() || null,
      address: String(formData.get('address') ?? '').trim() || null,
    };

    setCustomerCreateError('');
    setIsCreatingCustomer(true);
    try {
      const response = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setCustomerCreateError(data?.error ?? 'Não foi possível criar o cliente. Tente novamente.');
        return;
      }
      const customer: Customer = { id: data.id, name: data.name, nif: data.nif ?? null };
      setCustomers((current) => [...current, customer].sort((a, b) => a.name.localeCompare(b.name)));
      selectCustomer(customer);
      setCreatingCustomer(false);
    } catch {
      setCustomerCreateError('Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.');
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const productIndex = creatingProductFor;
    if (productIndex === null) return;
    const payload = {
      codigo: String(formData.get('codigo') ?? '').trim() || null,
      nome: String(formData.get('nome') ?? '').trim(),
      preco: String(formData.get('preco') ?? ''),
      stock: String(formData.get('stock') ?? ''),
      categoria: String(formData.get('categoria') ?? '').trim() || 'GERAL',
    };

    setProductCreateError('');
    setIsCreatingProduct(true);
    try {
      const response = await fetch('/api/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.produto) {
        setProductCreateError(data?.error ?? 'Não foi possível criar o produto. Tente novamente.');
        return;
      }
      const product: Product = { ...data.produto, price: Number(data.produto.price) };
      setProducts((current) => [...current, product].sort((a, b) => a.name.localeCompare(b.name)));
      selectProduct(productIndex, product);
      setCreatingProductFor(null);
    } catch {
      setProductCreateError('Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.');
    } finally {
      setIsCreatingProduct(false);
    }
  }

  const [pendingShare, startShareTransition] = useTransition();
  const startShare = () => startShareTransition(async () => {
    if (!emitted) return;
    const result = await createInvoiceShare(emitted.id);
    if (result.ok && result.url) {
      setShareUrl(result.url);
      window.open(`https://wa.me/?text=${encodeURIComponent(`Aqui está a tua factura ${emitted.number}: ${result.url}`)}`, '_blank');
    } else {
      setError(result.error ?? 'Não foi possível criar o link de partilha.');
    }
  });

  const handleGeneratePDF = async () => {
    setError('');
    setIsGenerating(true);
    if (!validItems.length) {
      setError('Adiciona pelo menos um artigo com descrição antes de emitir.');
      setIsGenerating(false);
      return;
    }
    try {
      const response = await fetch('/api/invoices/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, customerNif, items: validItems, total, applyVat, discountType, discountValue, observations, includeCompanyProfile, dueAt: dueAt || null, companyBankAccountId: companyBankAccountId || null }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(getInvoiceApiErrorMessage(payload));
        return;
      }

      const blob = await response.blob();
      const invoiceId = response.headers.get('X-Invoice-Id') ?? '';
      const invoiceNumber = response.headers.get('X-Invoice-Number') ?? '';
      if (invoiceId) {
        setEmitted({ id: invoiceId, number: invoiceNumber });
        setShareUrl(null);
        setShareCopied(false);
        setTimeout(() => successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fatura.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Não foi possível comunicar com o servidor. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    setError('');
    setDraftSaved('');
    setIsSavingDraft(true);
    try {
      const response = await fetch(draftId ? `/api/invoices/drafts/${draftId}` : '/api/invoices/drafts', {
        method: draftId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, customerNif, items: validItems, applyVat, discountType, discountValue, observations, includeCompanyProfile, dueAt: dueAt || null, companyBankAccountId: companyBankAccountId || null, currency: 'AOA' }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.draft?.id) { setError(data?.error ?? 'Não foi possível guardar o rascunho.'); return; }
      setDraftId(data.draft.id);
      setDraftSaved('Rascunho guardado. Ainda não foi emitido nem assinado.');
    } catch {
      setError('Não foi possível comunicar com o servidor. Tente novamente.');
    } finally { setIsSavingDraft(false); }
  };

  return <div className="space-y-6">
    {emitted && <div ref={successRef} className="rounded-2xl border-2 border-[#cbe8dc] bg-[#eff9f4] p-5 md:p-6">
      <p className="flex items-center gap-2 font-bold text-[#227958]"><CheckIcon className="h-5 w-5" /> Factura {emitted.number} emitida e assinada digitalmente! O PDF foi descarregado.</p>
      <p className="mt-1 text-sm text-[#4a5f76]">Envia agora ao teu cliente:</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => { if (shareUrl) { window.open(`https://wa.me/?text=${encodeURIComponent(`Aqui está a tua factura ${emitted.number}: ${shareUrl}`)}`, '_blank'); return; } startShare(); }} disabled={pendingShare} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 text-sm font-bold text-white transition hover:bg-[#1fb855] disabled:cursor-wait disabled:opacity-60"><WhatsappIcon className="h-4 w-4" /> {pendingShare ? 'A criar link…' : shareUrl ? 'Abrir WhatsApp' : 'Enviar por WhatsApp'}</button>
        <Link href={`/invoices/${emitted.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#1c2d3f] transition hover:bg-[#f6f9fc]">Abrir a factura (email, pagamentos)</Link>
        <button type="button" onClick={() => { setEmitted(null); setShareUrl(null); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#1c2d3f] transition hover:bg-[#f6f9fc]">Emitir outra</button>
      </div>
      {shareUrl && <div className="mt-3 rounded-lg border border-[#cbe8dc] bg-white p-3 text-xs">
        <p className="font-semibold text-[#227958]">Link público da factura (30 dias):</p>
        <p className="mt-1 break-all rounded bg-[#f7f9fc] px-2 py-1.5 font-mono text-[11px] text-[#263c52]">{shareUrl}</p>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(shareUrl).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2500); }).catch(() => null); }} className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-[#cdddeb] bg-white px-3 py-1.5 text-xs font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]">{shareCopied ? 'Copiado ✓' : 'Copiar link'}</button>
      </div>}
    </div>}
    <div><p className="text-sm text-[#708195]">Documentos de venda</p><h2 className="mt-1 text-2xl font-bold tracking-tight">{initialDraft ? 'Editar rascunho' : 'Nova fatura'}</h2><p className="mt-2 text-sm text-[#708195]">Indique o adquirente e os artigos a incluir no documento.</p></div>

    <aside aria-label="Outros documentos de venda" className="rounded-xl border border-[#d8e1eb] bg-[#f7f9fc] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div><p className="text-sm font-semibold text-[#26354a]">Ainda não vai emitir a factura?</p><p className="mt-1 text-xs leading-5 text-[#708195]">Prepare primeiro um orçamento ou uma factura proforma em PDF.</p></div>
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
        <Link href="/ferramentas/orcamento-pdf" className="inline-flex min-h-10 items-center rounded-lg border border-[#cdddeb] bg-white px-3 text-xs font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]">Criar orçamento</Link>
        <Link href="/ferramentas/factura-proforma" className="inline-flex min-h-10 items-center rounded-lg bg-[#021F87] px-3 text-xs font-semibold text-white transition hover:bg-[#061965]">Criar proforma</Link>
      </div>
    </aside>

    <section className="rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_3px_14px_rgba(25,52,80,.035)]">
      <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6"><h3 className="font-bold text-[#1c2d3f]">Dados do adquirente</h3><p className="mt-1 text-xs text-[#708195]">Escolha um cliente existente ou introduza um novo nome.</p></div>
      <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
        <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCustomerSuggestionsOpen(false); }}>
          <label htmlFor="customerName" className="app-label">Adquirente (Nome)</label>
          <input id="customerName" role="combobox" aria-autocomplete="list" aria-expanded={customerSuggestionsOpen} aria-controls="customer-options" className="app-input" value={customerName} onFocus={() => setCustomerSuggestionsOpen(true)} onChange={(event) => { setCustomerName(event.target.value); setCustomerNif(''); setCustomerSuggestionsOpen(true); }} placeholder="Escreva para procurar clientes" autoComplete="off" />
          {customerSuggestionsOpen && <div id="customer-options" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#dfe7ef] bg-white p-1.5 shadow-xl">
            {matchingCustomers.length ? matchingCustomers.map((customer) => <button key={customer.id} type="button" role="option" aria-selected={customer.name === customerName} onMouseDown={(event) => event.preventDefault()} onClick={() => selectCustomer(customer)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#f2f7fb] focus:bg-[#f2f7fb] focus:outline-none"><span className="truncate text-sm font-semibold text-[#263c52]">{customer.name}</span><span className="shrink-0 text-xs text-[#708195]">{customer.nif ? `NIF ${customer.nif}` : 'Sem NIF'}</span></button>) : <p className="px-3 py-2.5 text-sm text-[#708195]">Nenhum cliente encontrado.</p>}
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCustomerCreateError(''); setCustomerSuggestionsOpen(false); setCreatingCustomer(true); }} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-[#e7edf3] px-3 py-3 text-left text-sm font-semibold text-[#2878d0] hover:bg-[#f2f7fb]"><span aria-hidden="true">＋</span>Criar novo cliente{customerName.trim() ? ` “${customerName.trim()}”` : ''}</button>
          </div>}
        </div>
        <div><label htmlFor="customerNif" className="app-label">NIF do Adquirente <span className="font-normal text-[#708195]">(opcional)</span></label><input id="customerNif" className="app-input" value={customerNif} onChange={(event) => setCustomerNif(event.target.value)} placeholder="NIF" /><p className="mt-1.5 text-xs text-[#708195]">Preencha apenas se o cliente tiver NIF.</p></div>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_3px_14px_rgba(25,52,80,.035)]">
      <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6"><h3 className="font-bold text-[#1c2d3f]">Artigos e serviços</h3><p className="mt-1 text-xs text-[#708195]">Procure um produto do catálogo ou escreva uma descrição livre.</p></div>
      <div className="space-y-4 p-5 md:p-6">
        {items.map((item, index) => {
          const query = item.desc.trim().toLocaleLowerCase();
          const suggestions = products.filter((product) => !query || product.name.toLocaleLowerCase().includes(query) || (product.codigo ?? '').toLocaleLowerCase().includes(query)).slice(0, 6);
          return <div key={index} className="grid gap-3 rounded-xl border border-[#e7edf3] bg-[#fbfcfe] p-4 lg:grid-cols-[minmax(220px,1fr)_100px_150px_130px_44px] lg:items-end">
            <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && activeProductIndex === index) setActiveProductIndex(null); }}>
              <label htmlFor={`item-description-${index}`} className="app-label">Descrição</label>
              <input id={`item-description-${index}`} role="combobox" aria-autocomplete="list" aria-expanded={activeProductIndex === index} aria-controls={`product-options-${index}`} className="app-input" value={item.desc} onFocus={() => setActiveProductIndex(index)} onChange={(event) => { updateItem(index, { desc: event.target.value, productId: null }); setActiveProductIndex(index); }} placeholder="Nome do produto ou serviço" autoComplete="off" />
              {activeProductIndex === index && <div id={`product-options-${index}`} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#dfe7ef] bg-white p-1.5 shadow-xl">
                {suggestions.length ? suggestions.map((product) => <button key={product.id} type="button" role="option" aria-selected={product.id === item.productId} onMouseDown={(event) => event.preventDefault()} onClick={() => selectProduct(index, product)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#f2f7fb] focus:bg-[#f2f7fb] focus:outline-none"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#263c52]">{product.name}</span><span className="text-xs text-[#708195]">{product.codigo || 'Sem código'}</span></span><span className="tabular-nums shrink-0 text-sm font-semibold text-[#30465c]">{product.price.toFixed(2)} Kz</span></button>) : <p className="px-3 py-2.5 text-sm text-[#708195]">Nenhum produto encontrado.</p>}
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setProductCreateError(''); setActiveProductIndex(null); setCreatingProductFor(index); }} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-[#e7edf3] px-3 py-3 text-left text-sm font-semibold text-[#2878d0] hover:bg-[#f2f7fb]"><span aria-hidden="true">＋</span>Criar novo produto{item.desc.trim() ? ` “${item.desc.trim()}”` : ''}</button>
              </div>}
            </div>
            <div><label htmlFor={`item-quantity-${index}`} className="app-label">Quantidade</label><input id={`item-quantity-${index}`} type="number" min="0.01" step="0.01" className="app-input tabular-nums" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} /></div>
            <div><label htmlFor={`item-rate-${index}`} className="app-label">Preço unit. (AOA)</label><input id={`item-rate-${index}`} type="number" min="0" step="0.01" className="app-input tabular-nums" value={item.rate} onChange={(event) => updateItem(index, { rate: Number(event.target.value) })} /></div>
            <div className="lg:pb-2"><span className="app-label">Total (AOA)</span><p className="tabular-nums py-2 text-sm font-bold text-[#31475d]">{(item.qty * item.rate).toFixed(2)} AOA</p></div>
            <div className="flex items-end justify-end lg:pb-1.5">{items.length > 1 && <button type="button" onClick={() => removeItem(index)} aria-label={`Remover linha ${index + 1}`} title="Remover linha" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#f0c9c9] bg-white text-base font-bold text-[#a83939] transition hover:bg-red-50">✕</button>}</div>
          </div>;
        })}
      </div>
      <div className="border-t border-[#e7edf3] px-5 py-4 md:px-6"><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#2878D0] transition hover:bg-[#f4f8fc]" onClick={addItem}><span className="text-lg leading-none" aria-hidden="true">+</span>Adicionar linha</button></div>
    </section>

    <div className="grid gap-4 md:grid-cols-2">
    <section className="w-full rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-6">
      <h3 className="mb-4 font-bold text-[#1c2d3f]">Resumo da fatura</h3>
      <div className="space-y-4 border-b border-[#e7edf3] pb-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#30465c]"><input type="checkbox" checked={applyVat} onChange={(event) => setApplyVat(event.target.checked)} className="h-4 w-4 accent-[#2878d0]" />Aplicar IVA de 14% à fatura</label>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
          <div><label htmlFor="invoice-discount-type" className="app-label">Desconto</label><select id="invoice-discount-type" className="app-input" value={discountType} onChange={(event) => setDiscountType(event.target.value as 'amount' | 'percent')}><option value="amount">Valor (Kz)</option><option value="percent">Percentagem (%)</option></select></div>
          <div><label htmlFor="invoice-discount-value" className="app-label">{discountType === 'percent' ? 'Percentagem' : 'Valor'}</label><input id="invoice-discount-value" type="number" min="0" max={discountType === 'percent' ? 100 : undefined} step="0.01" className="app-input tabular-nums" value={discountValue} onChange={(event) => setDiscountValue(Math.max(0, Number(event.target.value)))} /></div>
        </div>
      </div>
      <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4 text-[#607286]"><span>Subtotal</span><span className="tabular-nums">{subtotal.toFixed(2)} AOA</span></div>{discountAmount > 0 && <div className="flex justify-between gap-4 text-[#607286]"><span>Desconto</span><span className="tabular-nums">−{discountAmount.toFixed(2)} AOA</span></div>}<div className="flex justify-between gap-4 text-[#607286]"><span>{applyVat ? 'IVA (14%)' : 'IVA (não aplicado)'}</span><span className="tabular-nums">{tax.toFixed(2)} AOA</span></div><div className="flex justify-between gap-4 border-t border-[#e7edf3] pt-4 text-base font-bold text-[#1c2d3f]"><span>Total</span><span className="tabular-nums">{total.toFixed(2)} AOA</span></div></div>
      <label className="mt-5 flex cursor-pointer items-start gap-2 border-t border-[#e7edf3] pt-4 text-sm font-medium text-[#30465c]"><input type="checkbox" checked={includeCompanyProfile} onChange={(event) => setIncludeCompanyProfile(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#2878d0]" /><span>Incluir dados da empresa no PDF<p className="mt-1 text-xs font-normal text-[#708195]">{hasCompanyProfile ? 'Usa o perfil guardado em Dados da empresa.' : 'Configure os dados da empresa para os apresentar na factura.'}</p></span></label>
    </section>

    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-6">
      <h3 className="mb-4 font-bold text-[#1c2d3f]">Pagamento e vencimento</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="invoice-due-at" className="app-label">Data de vencimento <span className="font-normal text-[#708195]">(opcional)</span></label><input id="invoice-due-at" type="date" className="app-input" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div>
        {bankAccounts.length > 0 && <div><label htmlFor="invoice-bank-account" className="app-label">Conta bancária da empresa <span className="font-normal text-[#708195]">(opcional)</span></label><select id="invoice-bank-account" className="app-input" value={companyBankAccountId} onChange={(event) => setCompanyBankAccountId(event.target.value)}><option value="">Usar conta do perfil, se existir</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.label || account.bankName} · {account.bankName}</option>)}</select></div>}
      </div>
    </section>

    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 shadow-[0_3px_14px_rgba(25,52,80,.035)] md:p-6">
      <label htmlFor="invoice-observations" className="app-label">Observações <span className="font-normal text-[#708195]">(opcional)</span></label>
      <textarea id="invoice-observations" className="app-input min-h-24 resize-y" maxLength={2000} value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Notas adicionais para incluir na fatura" />
      <p className="mt-1 text-xs text-[#708195]">As observações serão incluídas no PDF.</p>
    </section>
    </div>

    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
    {draftSaved && <p role="status" className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{draftSaved}</p>}
    <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
    <button type="button" className="flex min-h-12 items-center justify-center rounded-xl border border-[#cdddeb] bg-white px-5 py-3 font-bold text-[#2878D0] transition hover:bg-[#f4f8fc] disabled:cursor-wait disabled:opacity-60" onClick={handleSaveDraft} disabled={isSavingDraft || isGenerating}>
      {isSavingDraft ? 'A guardar rascunho…' : 'Guardar rascunho'}
    </button>
    <button type="button" className="flex min-h-12 items-center justify-center rounded-xl bg-[#2878D0] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60" onClick={handleGeneratePDF} disabled={isGenerating || isSavingDraft}>
      {isGenerating ? 'A gerar PDF…' : 'Gerar PDF Final'}
    </button>
    </div>

    {creatingCustomer && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isCreatingCustomer) setCreatingCustomer(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="invoice-new-customer-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Cadastro rápido</p><h3 id="invoice-new-customer-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">Novo cliente</h3><p className="mt-1 text-sm text-[#708195]">Será guardado no cadastro e seleccionado nesta fatura.</p></div><button type="button" aria-label="Fechar" disabled={isCreatingCustomer} onClick={() => setCreatingCustomer(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button></div>
        <form className="space-y-4" onSubmit={handleCreateCustomer}>
          <div><label htmlFor="invoice-new-customer-name" className="app-label">Nome do cliente <span className="text-[#c44747]">*</span></label><input id="invoice-new-customer-name" name="name" className="app-input" defaultValue={customerName} maxLength={160} required autoFocus /></div>
          <div><label htmlFor="invoice-new-customer-nif" className="app-label">NIF <span className="font-normal text-[#708195]">(opcional)</span></label><input id="invoice-new-customer-nif" name="nif" className="app-input" inputMode="numeric" /></div>
          <div><label htmlFor="invoice-new-customer-email" className="app-label">Email <span className="font-normal text-[#708195]">(opcional)</span></label><input id="invoice-new-customer-email" name="email" type="email" className="app-input" /></div>
          <div><label htmlFor="invoice-new-customer-address" className="app-label">Morada <span className="font-normal text-[#708195]">(opcional)</span></label><input id="invoice-new-customer-address" name="address" className="app-input" /></div>
          {customerCreateError && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{customerCreateError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCreatingCustomer(false)} disabled={isCreatingCustomer} className="min-h-10 rounded-lg border border-[#d8e1eb] bg-white px-4 text-sm font-semibold text-[#30465c] hover:bg-[#f7f9fc] disabled:opacity-55">Cancelar</button><button type="submit" disabled={isCreatingCustomer} className="min-h-10 rounded-lg bg-[#2878d0] px-4 text-sm font-semibold text-white hover:bg-[#216bbd] disabled:opacity-55">{isCreatingCustomer ? 'A guardar…' : 'Guardar e seleccionar'}</button></div>
        </form>
      </section>
    </div>}

    {creatingProductFor !== null && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isCreatingProduct) setCreatingProductFor(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="invoice-new-product-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Cadastro rápido</p><h3 id="invoice-new-product-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">Novo produto</h3><p className="mt-1 text-sm text-[#708195]">Será guardado no catálogo e adicionado a esta linha.</p></div><button type="button" aria-label="Fechar" disabled={isCreatingProduct} onClick={() => setCreatingProductFor(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button></div>
        <form className="space-y-4" onSubmit={handleCreateProduct}>
          <div><label htmlFor="invoice-new-product-name" className="app-label">Nome do produto <span className="text-[#c44747]">*</span></label><input id="invoice-new-product-name" name="nome" className="app-input" defaultValue={items[creatingProductFor]?.desc ?? ''} maxLength={160} required autoFocus /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="invoice-new-product-price" className="app-label">Preço (Kz) <span className="text-[#c44747]">*</span></label><input id="invoice-new-product-price" name="preco" type="number" className="app-input tabular-nums" min="0" step="0.01" required /></div><div><label htmlFor="invoice-new-product-stock" className="app-label">Stock <span className="font-normal text-[#708195]">(opcional)</span></label><input id="invoice-new-product-stock" name="stock" type="number" className="app-input tabular-nums" min="0" step="1" placeholder="0" /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="invoice-new-product-code" className="app-label">Código <span className="font-normal text-[#708195]">(opcional)</span></label><input id="invoice-new-product-code" name="codigo" className="app-input" /></div><div><label htmlFor="invoice-new-product-category" className="app-label">Categoria <span className="font-normal text-[#708195]">(opcional)</span></label><input id="invoice-new-product-category" name="categoria" className="app-input" defaultValue="GERAL" /></div></div>
          {productCreateError && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{productCreateError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCreatingProductFor(null)} disabled={isCreatingProduct} className="min-h-10 rounded-lg border border-[#d8e1eb] bg-white px-4 text-sm font-semibold text-[#30465c] hover:bg-[#f7f9fc] disabled:opacity-55">Cancelar</button><button type="submit" disabled={isCreatingProduct} className="min-h-10 rounded-lg bg-[#2878d0] px-4 text-sm font-semibold text-white hover:bg-[#216bbd] disabled:opacity-55">{isCreatingProduct ? 'A guardar…' : 'Guardar e adicionar'}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
