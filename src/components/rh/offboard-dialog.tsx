'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormError, CalendarField } from '@/components/rh/form-kit';
export function OffboardDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastDay, setLastDay] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/rh/employees/${employeeId}/offboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: String(form.get('reason') ?? ''),
          lastDay: String(form.get('lastDay') ?? ''),
          notes: String(form.get('notes') ?? ''),
          revokeAccess: form.get('revokeAccess') === 'on',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível desligar.');
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-lg border border-[#f0d3d3] bg-white px-4 text-sm font-semibold text-[#a83939]">
        Desligar funcionário
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={`Desligar ${employeeName}`} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form onSubmit={submit} className="w-full max-w-lg rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="text-base font-bold text-[#1c2d3f]">Desligar {employeeName}</h2>
            <p className="mt-1 text-xs text-[#607286]">O histórico é preservado. Esta acção fica registada na auditoria.</p>
            <FormSection title="Confirmar desligamento">
              <div>
                <FormField label="Motivo" name="off-reason" required>
                  <select id="off-reason" name="reason" className="ds-input" required defaultValue="">
                    <option value="" disabled>Selecionar</option>
                    <option value="PEDIDO_DE_FUNCIONARIO">Pedido do funcionário</option>
                    <option value="RESILIACAO_PELO_EMPREGADOR">Resiliação pelo empregador</option>
                    <option value="FIM_DE_CONTRATO">Fim de contrato</option>
                    <option value="REFORMA">Reforma</option>
                    <option value="MUTUO_ACORDO">Mútuo acordo</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </FormField>
              </div>
              <div>
                <FormField label="Data efectiva" name="off-lastday" required><CalendarField id="off-lastday" name="lastDay" value={lastDay} onChange={setLastDay} required /></FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Notas" name="off-notes"><textarea id="off-notes" name="notes" className="app-input min-h-20" /></FormField>
              </div>
              <label className="flex items-start gap-2 text-xs text-[#52667a] sm:col-span-2">
                <input type="checkbox" name="revokeAccess" className="mt-0.5" />
                Revogar acesso ao portal se o funcionário tiver utilizador com o mesmo email.
              </label>
            </FormSection>
            <FormError>{error}</FormError>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-[#cdddeb] px-4 text-sm font-semibold text-[#52667a]">Cancelar</button>
              <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-[#7a2f2f] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A desligar…' : 'Confirmar desligamento'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
