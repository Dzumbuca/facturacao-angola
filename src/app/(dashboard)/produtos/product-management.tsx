'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Product = {
  id: string;
  codigo: string | null;
  name: string;
  price: number;
  stock: number;
  categoria: string;
};

export function ProductManagement({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    setIsSaving(true);

    const form = new FormData(formElement);
    const payload = {
      codigo: String(form.get('codigo') ?? '').trim() || null,
      nome: String(form.get('nome') ?? '').trim(),
      preco: String(form.get('preco') ?? ''),
      stock: String(form.get('stock') ?? ''),
      categoria: String(form.get('categoria') ?? '').trim() || 'GERAL',
    };

    try {
      const response = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível criar o produto. Tente novamente.');
        return;
      }

      setProducts((current) => [...current, data.produto]);
      setNotice('Produto criado com sucesso.');
      setIsOpen(false);
      formElement.reset();
    } catch {
      setError('Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  function openForm() {
    setError('');
    setNotice('');
    setIsOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-sm text-[#708195]">Catálogo da empresa</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Gestão de produtos</h2></div>
        <Button type="button" onClick={openForm}>Novo produto</Button>
      </div>

      {notice && <p role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm font-medium text-[#267256]">{notice}</p>}

      <Card>
        <CardHeader><CardTitle>Lista de produtos e artigos <span className="ml-2 rounded-full bg-[#eff4f8] px-2 py-1 align-middle text-xs font-semibold text-[#617488]">{products.length}</span></CardTitle></CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center"><p className="font-semibold text-[#344a60]">Nenhum produto registado.</p><p className="mt-1 text-sm text-[#708195]">Use “Novo produto” para registar o primeiro produto.</p></div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e1e8f0]">
              <table className="data-table min-w-[680px]">
                <thead><tr><th>Código</th><th>Nome</th><th>Preço (Kz)</th><th>Stock</th><th>Categoria</th></tr></thead>
                <tbody>
                  {products.map((product) => <tr key={product.id} className="transition hover:bg-[#f8fafc]">
                    <td className="font-mono text-xs text-[#64768a]">{product.codigo || 'SEM-COD'}</td>
                    <td className="font-semibold text-[#263c52]">{product.name}</td>
                    <td className="tabular-nums font-medium">{product.price.toFixed(2)}</td>
                    <td className="tabular-nums">{product.stock}</td>
                    <td className="text-[#607286]">{product.categoria}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="new-product-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Catálogo da empresa</p><h3 id="new-product-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">Novo produto</h3><p className="mt-1 text-sm text-[#708195]">Preencha os dados do artigo ou serviço.</p></div>
            <button type="button" aria-label="Fechar" disabled={isSaving} onClick={() => setIsOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div><label htmlFor="product-name" className="app-label">Nome do produto <span className="text-[#c44747]">*</span></label><input id="product-name" name="nome" className="app-input" maxLength={160} required autoFocus /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="product-price" className="app-label">Preço (Kz) <span className="text-[#c44747]">*</span></label><input id="product-price" name="preco" type="number" className="app-input tabular-nums" min="0" step="0.01" required /></div>
              <div><label htmlFor="product-stock" className="app-label">Stock <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-stock" name="stock" type="number" className="app-input tabular-nums" min="0" step="1" placeholder="0" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="product-code" className="app-label">Código <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-code" name="codigo" className="app-input" /></div>
              <div><label htmlFor="product-category" className="app-label">Categoria <span className="font-normal text-[#708195]">(opcional)</span></label><input id="product-category" name="categoria" className="app-input" defaultValue="GERAL" /></div>
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'A guardar…' : 'Guardar produto'}</Button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}
