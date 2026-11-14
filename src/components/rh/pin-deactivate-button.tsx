'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormError } from '@/components/rh/form-kit';

/** Botão de desactivar PIN — só aparece se estiver definido. */
export function PinDeactivateButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function deactivate() {
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/rh/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível desactivar.');
      setOpen(false);
      router.refresh();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#f0c0c0] bg-[#fdf2f2] px-4 text-xs font-semibold text-[#a83939] transition hover:bg-[#fbe4e4]">Desactivar PIN</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="pin-deactivate-title" className="fixed inset-0 z-[70] flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
          <div className="form-card-light w-full max-w-md rounded-t-2xl border border-[#e6eaf0] p-6 shadow-2xl sm:rounded-2xl">
            <h2 id="pin-deactivate-title" className="text-lg font-bold text-[var(--text)]">Desactivar PIN?</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">O funcionário deixa de poder marcar presença no quiosque. Podes redefinir o PIN a qualquer momento.</p>
            <FormError>{error}</FormError>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-[12px] border border-[#cdd6e3] bg-white px-4 text-sm font-semibold text-[#52667a] transition hover:bg-[#f3f6fa]">Cancelar</button>
              <button type="button" onClick={deactivate} disabled={saving} className="min-h-11 flex-1 rounded-[12px] bg-[#a83939] px-4 text-sm font-semibold text-white transition hover:bg-[#8a2b2b] disabled:opacity-60">{saving ? 'A desactivar…' : 'Desactivar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
