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
        <CardHeader><CardTitle>Lista de produtos e artigos <span className="ml-2 rounded-full bg-[#eff4f8] px-2 py-1 align-middle text-xs font-semibold text-[#617488]">{products.length}</span></CardTitle></CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center"><p className="font-semibold text-[#344a60]">Nenhum produto registado.</p><p className="mt-1 text-sm text-[#708195]">Use “Novo produto” para registar o primeiro produto.</p></div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e1e8f0]">
              <table className="data-table min-w-[760px]">
                <thead><tr><th>Nome</th><th>Código</th><th>Marca</th><th>Preço (Kz)</th>{wmsEnabled && <th>Stock</th>}<th>Categoria</th><th>Acções</th></tr></thead>
                <tbody>
                  {products.map((product) => <tr key={product.id} className="transition hover:bg-[#f8fafc]">
                    <td data-mobile-primary className="font-semibold text-[#263c52]">{product.name}</td>
                    <td className="font-mono text-xs text-[#64768a]">{product.codigo || 'SEM-COD'}</td>
                    <td className="text-[#607286]">{product.marca || '—'}</td>
                    <td className="tabular-nums font-medium">{product.price.toFixed(2)}</td>
                    {wmsEnabled && <td className="tabular-nums">{product.stock}</td>}
                    <td className="text-[#607286]">{product.categoria}</td>
                    <td data-mobile-actions>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEdit(product)} className="rounded-lg border border-[#cdddeb] px-3 py-1.5 text-sm font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]">Editar</button>
                        <button type="button" onClick={() => handleDelete(product)} className="rounded-lg border border-[#f0d3d3] px-3 py-1.5 text-sm font-semibold text-[#a83939] transition hover:bg-[#fdf3f3]">Apagar</button>
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isOpen && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Catálogo da empresa</p><h3 id="product-form-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">{editing ? 'Editar produto' : 'Novo produto'}</h3><p className="mt-1 text-sm text-[#708195]">Preencha os dados do artigo ou serviço.</p></div>
            <button type="button" aria-label="Fechar" disabled={isSaving} onClick={() => setIsOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit} key={editing?.id ?? 'novo'}>
            <fieldset className="space-y-4">
              <legend className="app-label font-bold uppercase tracking-[.12em] text-[#708195]">Identificação</legend>
              <div><label htmlFor="product-name" className="app-label">Nome do produto <span className="text-[#c44747]">*</span></label><input id="product-name" name="nome" className="app-input" maxLength={160} required autoFocus defaultValue={editing?.name ?? ''} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="product-code" className="app-label">SKU / Código interno <span className="font-normal text-[#708195]">(automático se vazio)</span></label><input id="product-code" name="codigo" className="app-input" placeholder="SKU-ABC123" defaultValue={editing?.codigo ?? ''} /></div>
                <div><label htmlFor="product-barcode" className="app-label">Código de barras <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-barcode" name="barcode" className="app-input" placeholder="0000000000000" defaultValue={editing?.barcode ?? ''} /></div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="app-label font-bold uppercase tracking-[.12em] text-[#708195]">Organização</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="product-category" className="app-label">Categoria <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-category" name="categoria" className="app-input" defaultValue={editing?.categoria ?? 'GERAL'} /></div>
                <div><label htmlFor="product-subcategory" className="app-label">Subcategoria <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-subcategory" name="subcategoria" className="app-input" defaultValue={editing?.subcategoria ?? ''} /></div>
                <div><label htmlFor="product-brand" className="app-label">Marca <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-brand" name="marca" className="app-input" defaultValue={editing?.marca ?? ''} /></div>
                <div><label htmlFor="product-model" className="app-label">Modelo / Referência <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-model" name="modelo" className="app-input" defaultValue={editing?.modelo ?? ''} /></div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="app-label font-bold uppercase tracking-[.12em] text-[#708195]">Preços e unidade</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label htmlFor="product-price" className="app-label">Preço de venda (Kz) <span className="text-[#c44747]">*</span></label><input id="product-price" name="preco" type="number" className="app-input tabular-nums" min="0" step="0.01" required defaultValue={editing?.price ?? ''} /></div>
                <div><label htmlFor="product-purchase" className="app-label">Preço de compra <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-purchase" name="purchasePrice" type="number" className="app-input tabular-nums" min="0" step="0.01" placeholder="0.00" defaultValue={editing?.purchasePrice ?? ''} /></div>
                <div><label htmlFor="product-unit" className="app-label">Unidade <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-unit" name="unidade" className="app-input" placeholder="un, cx, kg" defaultValue={editing?.unidade ?? 'un'} /></div>
              </div>
              {wmsEnabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label htmlFor="product-stock" className="app-label">Stock inicial <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-stock" name="stock" type="number" className="app-input tabular-nums" min="0" step="1" placeholder="0" defaultValue={editing?.stock ?? ''} /></div>
                  <div><label htmlFor="product-minstock" className="app-label">Stock mínimo <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-minstock" name="minStock" type="number" className="app-input tabular-nums" min="0" step="1" placeholder="0" defaultValue={editing?.minStock ?? ''} /></div>
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="app-label font-bold uppercase tracking-[.12em] text-[#708195]">Detalhes</legend>
              <div><label htmlFor="product-description" className="app-label">Descrição <span className="font-normal text-[#708195]">(opcional)</span></label><textarea id="product-description" name="description" className="app-input min-h-20 resize-y" maxLength={500} defaultValue={editing?.description ?? ''} /></div>
              <div><label htmlFor="product-image" className="app-label">URL da imagem <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-image" name="imageUrl" className="app-input" placeholder="https://…" defaultValue={editing?.imageUrl ?? ''} /></div>
            </fieldset>

            {!wmsEnabled && <p className="rounded-lg border border-[#e1e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#607286]">O controlo de stock faz parte dos pacotes pagos. <a href="/apps" className="font-semibold text-[#2878d0] underline">Ver pacotes</a></p>}
            {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex flex-col-reverse gap-2 border-t border-[#e7edf3] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:px-0 sm:pb-0">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'A guardar…' : editing ? 'Guardar alterações' : 'Guardar produto'}</Button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}
