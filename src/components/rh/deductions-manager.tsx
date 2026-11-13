'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError, CurrencyInput } from '@/components/rh/form-kit';
import { RhModuleHero, FormSplit, FormSidebar } from '@/components/rh/premium-kit';
type Deduction = { id: string; description: string; type: string; amount: number; remainingInstallments: number | null; active: boolean };

const TYPE_LABEL: Record<string, string> = { ADIANTAMENTO: 'Adiantamento', EMPRESTIMO: 'Empréstimo', OUTRO: 'Outro' };

export function DeductionsManager({ employeeId, deductions, canWrite }: { employeeId: string; deductions: Deduction[]; canWrite: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [amountValue, setAmountValue] = useState<number | null>(null);
  const [deductionType, setDeductionType] = useState('ADIANTAMENTO');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('create'); setError('');
    try {
      const response = await fetch('/api/rh/deductions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          description: String(form.get('description') ?? ''),
          type: String(form.get('type') ?? 'OUTRO'),
          amount: Number(form.get('amount') ?? '0'),
          remainingInstallments: String(form.get('installments') ?? '') ? Number(form.get('installments')) : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível criar.');
      event.currentTarget.reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function toggle(id: string, active: boolean) {
    setBusy(id); setError('');
    try {
      const response = await fetch(`/api/rh/deductions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error('Não foi possível actualizar.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-4">
    <RhModuleHero
      eyebrow="Payroll"
      title="Descontos recorrentes"
      description="Adiantamentos e descontos mensais promovidos directamente no processamento salarial. Nunca são aplicados sem registo."
      icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
    />
    <section className="rounded-[18px] border border-[#e2e8ef] bg-white shadow-[var(--shadow-card)] overflow-hidden">
      <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[var(--text)]">Descontos recorrentes</h2>

      {canWrite && (
        <form onSubmit={create} className="border-b border-[#eef2f6] bg-[#f9fbfe] px-4 py-4">
          <FormSplit main={<>
          <FormSection title="Novo desconto recorrente">
            <div className="sm:col-span-2">
              <FormField label="Descrição" name="ded-desc" required><input id="ded-desc" name="description" className="app-input" required maxLength={200} placeholder="Ex.: Adiantamento salário Maio" /></FormField>
            </div>
            <div>
              <FormField label="Valor (Kz)" name="ded-amount" required><CurrencyInput id="ded-amount" name="amount" value={amountValue} onChange={setAmountValue} required /></FormField>
            </div>
            <div>
              <FormField label="Tipo" name="ded-type">
                <select id="ded-type" name="type" className="app-input" value={deductionType} onChange={(e) => setDeductionType(e.target.value)}>
                  <option value="ADIANTAMENTO">Adiantamento</option>
                  <option value="EMPRESTIMO">Empréstimo</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Prestações" name="ded-installments" hint="Vazio = indefinido"><input id="ded-installments" name="installments" type="number" min="1" className="app-input" placeholder="3" /></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormError>{error}</FormError>
              <FormActions saving={busy === 'create'} onCancel={() => { /* noop */ }} saveLabel={busy === 'create' ? 'A criar…' : 'Adicionar'} />
            </div>
          </FormSection>
          </>}
          sidebar={<FormSidebar title="Resumo do desconto" progress={(amountValue != null ? 40 : 0) + (deductionType ? 30 : 0) + 30} lines={[
            { label: 'Tipo', value: ({ ADIANTAMENTO: 'Adiantamento', EMPRESTIMO: 'Empréstimo', OUTRO: 'Outro' } as any)[deductionType] ?? deductionType },
            { label: 'Valor', value: amountValue != null ? new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(amountValue) : undefined },
          ]} footer={<p className="text-[11px] leading-5 text-[#8094a9]">O desconto é aplicado no processamento seguinte ao registo.</p>} />} />
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="data-table min-w-[640px]">
          <thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Prestações</th><th>Estado</th>{canWrite && <th>Acções</th>}</tr></thead>
          <tbody>
            {deductions.map((deduction) => (
              <tr key={deduction.id}>
                <td data-mobile-primary className="font-semibold text-[var(--text)]">{deduction.description}</td>
                <td>{TYPE_LABEL[deduction.type] ?? deduction.type}</td>
                <td className="tabular-nums">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(deduction.amount)}</td>
                <td className="tabular-nums">{deduction.remainingInstallments === null ? '∞' : deduction.remainingInstallments}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${deduction.active ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#f0f3f7] text-[#52667a]'}`}>{deduction.active ? 'Ativo' : 'Inativo'}</span></td>
                {canWrite && (
                  <td data-mobile-actions>
                    <button type="button" onClick={() => toggle(deduction.id, !deduction.active)} disabled={busy === deduction.id} className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[#52667a] disabled:opacity-50">
                      {deduction.active ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {deductions.length === 0 && <tr><td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Sem descontos recorrentes.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    </div>
  );
}