'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  onSuccess: () => void;
};

export function NewWarehouseDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/stock/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location, isDefault }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao criar armazém');
      }

      setName('');
      setLocation('');
      setIsDefault(false);
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={loading}>
        Novo armazém
      </Button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="warehouse-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2878d0]">Controlo de inventário</p>
                <h3 id="warehouse-form-title" className="mt-1 text-xl font-bold text-[#1c2d3f]">Novo armazém</h3>
                <p className="mt-1 text-sm text-[#708195]">Preencha os dados do armazém.</p>
              </div>
              <button type="button" aria-label="Fechar" disabled={loading} onClick={() => setOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f0f4f8] disabled:opacity-50">×</button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="warehouse-name" className="app-label">Nome do armazém <span className="text-[#c44747]">*</span></label>
                <input id="warehouse-name" name="name" className="app-input" maxLength={160} required autoFocus defaultValue={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="warehouse-location" className="app-label">Localização <span className="font-normal text-[#708195]">(opcional)</span></label>
                <input id="warehouse-location" name="location" className="app-input" defaultValue={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="flex items-start gap-3">
                <input id="warehouse-isdefault" name="isDefault" type="checkbox" className="app-input h-5 w-5" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                <label htmlFor="warehouse-isdefault" className="text-sm text-[#607286] leading-none">
                  Armazém predefinido
                </label>
              </div>
              {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-[#e7edf3] pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? 'A criar…' : 'Criar armazém'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
