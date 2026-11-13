'use client';

import { useState } from 'react';
import type { BillingCycle, PaidPackageSlug } from '@/lib/plan-pricing';

type PlanOption = { slug: PaidPackageSlug; name: string; priceKz: number; priceYearly: number | null };
const kz = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);

export function PaymentForm({ plans }: { plans: PlanOption[] }) {
  const [planSlug, setPlanSlug] = useState<PaidPackageSlug>(plans[0]?.slug ?? 'basico');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selected = plans.find((plan) => plan.slug === planSlug) ?? plans[0];
  const annualAvailable = Boolean(selected?.priceYearly && Number(selected.priceYearly) > 0);
  const effectiveCycle: BillingCycle = cycle === 'ANNUAL' && annualAvailable ? 'ANNUAL' : 'MONTHLY';
  const amount = effectiveCycle === 'ANNUAL' ? Number(selected?.priceYearly ?? 0) : Number(selected?.priceKz ?? 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    form.set('planSlug', planSlug);
    form.set('billingCycle', effectiveCycle);
    try {
      const response = await fetch('/api/plan/payment', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? 'Não foi possível enviar o comprovativo.');
        return;
      }
      window.location.reload();
    } catch {
      setError('Falha de comunicação com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return <form className="space-y-4" onSubmit={handleSubmit}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="pay-plan" className="app-label">Pacote</label>
        <select
          id="pay-plan"
          className="app-input"
          value={planSlug}
          onChange={(event) => {
            const next = event.target.value as PaidPackageSlug;
            setPlanSlug(next);
            const plan = plans.find((entry) => entry.slug === next);
            if (!plan?.priceYearly || Number(plan.priceYearly) <= 0) setCycle('MONTHLY');
          }}
        >
          {plans.map((plan) => <option key={plan.slug} value={plan.slug}>{plan.name} — {kz(Number(plan.priceKz))}/mês</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="pay-cycle" className="app-label">Pagamento</label>
        <select id="pay-cycle" className="app-input" value={effectiveCycle} onChange={(event) => setCycle(event.target.value as BillingCycle)}>
          <option value="MONTHLY">Mensal — 1 mês</option>
          {annualAvailable && <option value="ANNUAL">Anual — 12 meses (15% desconto)</option>}
        </select>
      </div>
    </div>

    <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">Total a transferir · {effectiveCycle === 'ANNUAL' ? '12 meses' : '1 mês'}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-[#2878d0]">{kz(amount)}</p>
      <p className="mt-2 text-sm text-[#4a5f76]">
        Envia via <strong>Multicaixa Express</strong> para o número
        <button type="button" onClick={() => navigator.clipboard?.writeText('937555618').catch(() => null)} className="mx-1.5 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-black tabular-nums text-[#102b46] shadow-[var(--shadow-card)] transition hover:bg-blue-50" title="Copiar número">
          937 555 618 <span aria-hidden="true" className="text-xs">📋</span>
        </button>
        (toca para copiar).
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="pay-name" className="app-label">Nome de quem pagou <span className="text-[#c44747]">*</span></label>
        <input id="pay-name" name="payerName" required maxLength={120} className="app-input" placeholder="Como aparece na transferência" />
      </div>
      <div>
        <label htmlFor="pay-phone" className="app-label">Telefone do pagador <span className="text-[#c44747]">*</span></label>
        <input id="pay-phone" name="payerPhone" required maxLength={24} inputMode="tel" className="app-input tabular-nums" placeholder="Ex.: 9XX XXX XXX" />
      </div>
    </div>

    <div>
      <label htmlFor="pay-proof" className="app-label">Comprovativo (imagem ou PDF, máx. 3 MB) <span className="text-[#c44747]">*</span></label>
      <input
        id="pay-proof"
        name="proof"
        type="file"
        required
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="app-input file:mr-3 file:rounded-md file:border-0 file:bg-[#eef6ff] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#2878d0]"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
      />
      {fileName && <p className="mt-1.5 text-xs text-[#227958]">Seleccionado: {fileName}</p>}
    </div>

    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-[#a83939]">{error}</p>}

    <button type="submit" disabled={loading || plans.length === 0} className="min-h-12 w-full rounded-lg bg-[#2878d0] px-4 py-3 font-semibold text-white transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60">
      {loading ? 'A enviar…' : 'Enviar comprovativo para confirmação'}
    </button>
    <p className="text-center text-xs text-[#708195]">A tua conta é activada logo que o pagamento for confirmado pela equipa.</p>
  </form>;
}
