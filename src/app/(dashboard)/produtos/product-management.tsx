'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Product = {
  id: string;
  codigo: string | null;
  barcode?: string | null;
  name: string;
  price: number;
  stock: number;
  minStock: number;
  categoria: string;
  subcategoria?: string | null;
  marca?: string | null;
  modelo?: string | null;
  unidade?: string;
  purchasePrice?: number | null;
  description?: string | null;
  imageUrl?: string | null;
};

export function ProductManagement({ initialProducts, wmsEnabled }: { initialProducts: Product[]; wmsEnabled: boolean }) {
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  const visible = products.filter((c) => !query.trim() || [c.name, c.codigo ?? '', c.marca ?? '', c.categoria].join(' ').toLowerCase().includes(query.trim().toLowerCase()));

  function openCreate() {
    setEditing(null);
    setError('');
    setNotice('');
    setIsOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setError('');
    setNotice('');
    setIsOpen(true);
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Apagar o produto "${product.name}"? Esta acção não pode ser revertida.`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/produtos/${product.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível apagar o produto.');
        return;
      }
      setProducts((current) => current.filter((entry) => entry.id !== product.id));
      setNotice('Produto apagado.');
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
    const payload: Record<string, unknown> = {
      codigo: String(form.get('codigo') ?? '').trim() || null,
      nome: String(form.get('nome') ?? '').trim(),
      preco: String(form.get('preco') ?? ''),
      categoria: String(form.get('categoria') ?? '').trim() || 'GERAL',
      barcode: String(form.get('barcode') ?? '').trim() || null,
      subcategoria: String(form.get('subcategoria') ?? '').trim() || null,
      marca: String(form.get('marca') ?? '').trim() || null,
      modelo: String(form.get('modelo') ?? '').trim() || null,
      unidade: String(form.get('unidade') ?? '').trim() || null,
      purchasePrice: String(form.get('purchasePrice') ?? '').trim() || null,
      description: String(form.get('description') ?? '').trim() || null,
      imageUrl: String(form.get('imageUrl') ?? '').trim() || null,
    };
    if (wmsEnabled) {
      payload.stock = String(form.get('stock') ?? '');
      payload.minStock = String(form.get('minStock') ?? '');
    }

    try {
      const editingProduct = editing;
      const response = await fetch(editingProduct ? `/api/produtos/${editingProduct.id}` : '/api/produtos', {
        method: editingProduct ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível guardar o produto. Tente novamente.');
        return;
      }

      setProducts((current) => editingProduct
        ? current.map((entry) => (entry.id === editingProduct.id ? data.produto : entry))
        : [...current, data.produto]);
      setNotice(editingProduct ? 'Produto actualizado com sucesso.' : 'Produto criado com sucesso.');
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
        <div><p className="text-sm text-[#708195]">Catálogo da empresa</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Gestão de produtos</h2></div>
        <Button type="button" onClick={openCreate}>Novo produto</Button>
      </div>

      {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm font-medium text-[#267256]">{notice}</p>}
      {error && !isOpen && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#a83939]">{error}</p>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><CardTitle>Lista de produtos e artigos</CardTitle><p className="mt-1 text-xs text-[var(--text-muted)]">{products.length} {products.length === 1 ? 'produto' : 'produtos'} registado{products.length === 1 ? '' : 's'}</p></div>
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Pesquisar produtos</span>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por nome, código, marca..." autoComplete="off" className="app-input h-11 pl-10" aria-label="Pesquisar produtos" />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[var(--line)] bg-[var(--surface-raised)] px-5 py-10 text-center"><p className="font-semibold text-[var(--text)]">{query ? 'Nenhum produto corresponde à pesquisa.' : 'Nenhum produto registado.'}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{query ? 'Experimenta outra palavra.' : 'Use “Novo produto” para registar o primeiro produto.'}</p></div>
          ) : (
            <div className="overflow-x-auto rounded-[16px] border border-[var(--line)]">
              <table className="data-table min-w-[760px]">
                <thead><tr><th>Nome</th><th>Código</th>{<th>Marca</th>}<th className="text-right">Preço (Kz)</th>{wmsEnabled && <th className="text-right">Stock</th>}<th>Categoria</th><th className="text-right">Acções</th></tr></thead>
                <tbody>
                  {visible.map((product) => <tr key={product.id} className="transition hover:bg-[var(--surface-raised)]">
                    <td data-mobile-primary className="font-semibold text-[var(--text)]">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--surface-raised)] ring-1 ring-[var(--line)] text-[var(--text-muted)]">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 6l9 7 9-7"/></svg>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--text)]">{product.name}</span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-[var(--text-muted)]">SKU · {product.codigo || 'SEM-COD'}</span>
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-[11px] text-[var(--text-muted)]">{product.codigo || 'SEM-COD'}</td>
                    <td className="text-[var(--text-muted)]">{product.marca || '—'}</td>
                    <td className="text-right tabular-nums font-bold text-[var(--text)]">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(product.price)}</td>
                    {wmsEnabled && <td className="text-right tabular-nums text-[var(--text)]">{product.stock}</td>}
                    <td className="text-[var(--text-muted)]">{product.categoria}</td>
                    <td data-mobile-actions>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openEdit(product)} className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--blue)] transition hover:border-[var(--blue)]">Editar</button>
                        <button type="button" onClick={() => handleDelete(product)} className="rounded-[10px] border border-[#f0d3d3] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--danger)] transition hover:bg-[#fdf2f2]">Apagar</button>
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isOpen && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#102b46]/50 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-2xl">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--blue)]">Catálogo da empresa</p><h3 id="product-form-title" className="mt-1 text-lg font-extrabold text-[var(--text)]">{editing ? 'Editar produto' : 'Novo produto'}</h3></div>
            <button type="button" aria-label="Fechar" disabled={isSaving} onClick={() => setIsOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--text)] disabled:opacity-50">×</button>
          </div>
          {!wmsEnabled && <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-2 text-[11px] font-semibold text-[var(--text-muted)] sm:px-6">Controlo de stock é funcionalidade Pro.<a href="/apps" className="ml-1 text-[var(--blue)] underline">Ver pacotes →</a></div>}
          <p className="shrink-0 border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] sm:px-6">Campos marcados com <span className="text-[#c44747]">*</span> são obrigatórios</p>

          <form id="product-form" className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6" onSubmit={handleSubmit} key={editing?.id ?? 'novo'}>
            <fieldset className="space-y-3">
              <legend className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Identificação</legend>
              <div><label htmlFor="product-name" className="app-label">Nome do produto <span className="text-[#c44747]">*</span></label><input id="product-name" name="nome" className="ds-input" maxLength={160} required autoFocus defaultValue={editing?.name ?? ''} placeholder="Ex.: Deo Colónia Feminino Humor" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="product-code" className="app-label">SKU / Código interno <span className="font-normal text-[var(--text-muted)]">(auto se vazio)</span></label><input id="product-code" name="codigo" className="ds-input" placeholder="SKU-ABC123" defaultValue={editing?.codigo ?? ''} /></div>
                <div><label htmlFor="product-barcode" className="app-label">Código de barras <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-barcode" name="barcode" className="ds-input" inputMode="numeric" placeholder="1234567890123" defaultValue={editing?.barcode ?? ''} /><p className="mt-1 text-[10px] text-[var(--text-muted)]">Formato EAN-13 (opcional)</p></div>
              </div>
            </fieldset>

            <fieldset className="mt-5 border-t border-[var(--line)] pt-5">
              <legend className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Organização</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="product-category" className="app-label">Categoria <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-category" name="categoria" className="ds-input" defaultValue={editing?.categoria ?? 'GERAL'} /></div>
                <div><label htmlFor="product-subcategory" className="app-label">Subcategoria <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-subcategory" name="subcategoria" className="ds-input" defaultValue={editing?.subcategoria ?? ''} /></div>
                <div><label htmlFor="product-brand" className="app-label">Marca <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-brand" name="marca" className="ds-input" defaultValue={editing?.marca ?? ''} /></div>
                <div><label htmlFor="product-model" className="app-label">Modelo / Referência <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-model" name="modelo" className="ds-input" defaultValue={editing?.modelo ?? ''} /></div>
              </div>
            </fieldset>

            <fieldset className="mt-5 border-t border-[var(--line)] pt-5">
              <legend className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Preços e unidade</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div className="relative"><label htmlFor="product-price" className="app-label">Preço de venda <span className="text-[#c44747]">*</span></label><input id="product-price" name="preco" type="number" className="app-input tabular-nums pr-10" min="0" step="0.01" required placeholder="0,00" defaultValue={editing?.price ?? ''} /><span aria-hidden="true" className="pointer-events-none absolute right-3 bottom-3 text-xs font-bold text-[var(--text-muted)]">Kz</span></div>
                <div><label htmlFor="product-purchase" className="app-label">Preço de compra <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-purchase" name="purchasePrice" type="number" className="app-input tabular-nums" min="0" step="0.01" placeholder="0,00" defaultValue={editing?.purchasePrice ?? ''} /></div>
                <div><label htmlFor="product-unit" className="app-label">Unidade <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><select id="product-unit" name="unidade" className="ds-input" defaultValue={editing?.unidade ?? 'un'}><option value="un">un</option><option value="kg">kg</option><option value="g">g</option><option value="lt">lt</option><option value="ml">ml</option><option value="m">m</option><option value="cm">cm</option><option value="cx">cx</option><option value="pc">pc</option><option value="dz">dz</option></select></div>
              </div>
              {wmsEnabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="product-stock" className="app-label">Stock inicial <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-stock" name="stock" type="number" className="app-input tabular-nums" min="0" step="1" placeholder="0" defaultValue={editing?.stock ?? ''} /></div>
                  <div><label htmlFor="product-minstock" className="app-label">Stock mínimo <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-minstock" name="minStock" type="number" className="app-input tabular-nums" min="0" step="1" placeholder="0" defaultValue={editing?.minStock ?? ''} /></div>
                </div>
              )}
            </fieldset>

            <fieldset className="mt-5 border-t border-[var(--line)] pt-5">
              <legend className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Detalhes</legend>
              <div className="mt-2"><label htmlFor="product-description" className="app-label">Descrição <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><textarea id="product-description" name="description" className="app-input min-h-16 resize-y" maxLength={500} placeholder="Ex.: Deo Colónia Feminino Humor 75 ml, fragrância adocicada" defaultValue={editing?.description ?? ''} /></div>
              {(editing?.imageUrl ?? '').trim() ? (
                <div className="mt-2 flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] p-2">
                  <img src={editing?.imageUrl ?? ''} alt={editing?.name ?? 'Imagem do produto'} className="h-16 w-16 rounded-[10px] object-cover" />
                  <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[.14em] text-[var(--text-muted)]">Imagem actual</p><p className="truncate text-[11px] text-[var(--text-muted)]">{editing?.imageUrl}</p></div>
                </div>
              ) : null}
              <div className="mt-2"><label htmlFor="product-image" className="app-label">URL da imagem <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label><input id="product-image" name="imageUrl" className="ds-input" type="url" placeholder="https://…" defaultValue={editing?.imageUrl ?? ''} /><p className="mt-1 text-[10px] text-[var(--text-muted)]">URL público da imagem (gestor de ficheiros externo)</p></div>
            </fieldset>

            {error && <p role="alert" className="mt-3 rounded-[10px] border border-[#f0d3d3] bg-[#fdf2f2] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}
          </form>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button type="submit" form="product-form" disabled={isSaving}>{isSaving ? 'A guardar…' : (editing ? 'Guardar alterações' : 'Guardar produto')}</Button>
          </div>
        </section>
      </div>}
    </div>
  );
}
