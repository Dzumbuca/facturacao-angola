'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
type Batch = {
  id: string; provider: string; status: string; total: number; reference: string | null;
  run: { period: string; status: string }; _count: { items: number };
};
type Run = { id: string; period: string; totalNet: number };

const STATUS: Record<string, string> = { DRAFT: 'Rascunho', SENT: 'Enviado', CONFIRMED: 'Confirmado', FAILED: 'Falhado' };
const TONE: Record<string, string> = {
  DRAFT: 'bg-[#fff7e6] text-[#8a5a00]', SENT: 'bg-[#eef4ff] text-[#021f87]',
  CONFIRMED: 'bg-[#eff9f4] text-[#267256]', FAILED: 'bg-[#fdf3f3] text-[#a83939]',
};

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export function PaymentsManager({ batches, runs }: { batches: Batch[]; runs: Run[] }) {
  const router = useRouter();
  const [runId, setRunId] = useState(runs[0]?.id ?? '');
  const [provider, setProvider] = useState('MANUAL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/rh/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId, provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível criar o lote.');
      setMessage('Lote criado. Envie quando estiver pronto.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function transition(id: string, status: string) {
    setError(''); setMessage('');
    try {
      const response = await fetch(`/api/rh/payments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Transição inválida.');
      setMessage(`Lote actualizado para ${STATUS[status] ?? status}.`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Payroll Connect</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Pagamentos</h1>
        <p className="mt-1 text-sm text-[#607286]">Lotes manuais. Nenhuma transferência bancária real é executada nesta versão.</p>
      </div>

      <form onSubmit={create} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <FormSection title="Criar lote de pagamentos">
          <div className="sm:col-span-2">
            <FormField label="Processamento aprovado" name="pay-run" required>
              <select id="pay-run" className="app-input" value={runId} onChange={(e) => setRunId(e.target.value)} required>
                <option value="">Selecionar</option>{runs.map((run) => <option key={run.id} value={run.id}>{run.period} — {money(run.totalNet)}</option>)}
              </select>
            </FormField>
          </div>
          <div>
            <FormField label="Canal" name="pay-provider">
              <select id="pay-provider" className="app-input" value={provider} onChange={(e) => setProvider(e.target.value)}><option value="MANUAL">Manual</option><option value="EMIS">EMIS (abstração)</option></select>
            </FormField>
          </div>
          {runs.length === 0 && <p className="mt-2 text-xs text-[#8a5a00]">Não há processamentos aprovados disponíveis.</p>}
          {message && <p role="status" className="mt-2 text-xs font-medium text-[#267256]">{message}</p>}
          <FormError>{error}</FormError>
          <div className="sm:col-span-3">
            <FormActions saving={saving} disabled={runs.length === 0} onCancel={() => {}} saveLabel={saving ? 'A criar…' : 'Criar lote'} />
          </div>
        </FormSection>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[720px]">
          <thead><tr><th>Período</th><th>Canal</th><th>Funcionários</th><th>Total</th><th>Estado</th><th>Acções</th></tr></thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td data-mobile-primary className="font-semibold tabular-nums">{batch.run.period}</td>
                <td>{batch.provider}</td>
                <td className="tabular-nums">{batch._count.items}</td>
                <td className="tabular-nums">{money(batch.total)}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[batch.status] ?? ''}`}>{STATUS[batch.status] ?? batch.status}</span></td>
                <td data-mobile-actions>
                  <div className="flex flex-wrap gap-2">
                    {batch.status === 'DRAFT' && <button type="button" onClick={() => transition(batch.id, 'SENT')} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">Enviar</button>}
                    {batch.status === 'SENT' && (
                      <>
                        <button type="button" onClick={() => transition(batch.id, 'CONFIRMED')} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256]">Confirmar</button>
                        <button type="button" onClick={() => transition(batch.id, 'FAILED')} className="min-h-9 rounded-lg border border-[#f0d3d3] px-3 text-xs font-semibold text-[#a83939]">Falhar</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {batches.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há lotes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
