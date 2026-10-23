'use client';

import { useState } from 'react';

const PRICES: Record<string, number> = { BASICO: 9900, PRO: 19900 };
const kz = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);

export function PaymentForm() {
  const [plan, setPlan] = useState<'BASICO' | 'PRO'>('BASICO');
  const [months, setMonths] = useState(1);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const amount = PRICES[plan] * months;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    form.set('plan', plan);
    form.set('months', String(months));
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
        <label htmlFor="pay-plan" className="app-label">Plano</label>
        <select id="pay-plan" className="app-input" value={plan} onChange={(event) => setPlan(event.target.value as 'BASICO' | 'PRO')}>
          <option value="BASICO">Básico — 9.900 Kz/mês (sem anúncios)</option>
          <option value="PRO">Pro — 19.900 Kz/mês (sem anúncios, tudo incluído)</option>
        </select>
      </div>
      <div>
        <label htmlFor="pay-months" className="app-label">Duração</label>
        <select id="pay-months" className="app-input" value={months} onChange={(event) => setMonths(Number(event.target.value))}>
          <option value="1">1 mês</option>
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">12 meses</option>
        </select>
      </div>
    </div>

    <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">Total a transferir</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-[#2878d0]">{kz(amount)}</p>
      <p className="mt-2 text-sm text-[#4a5f76]">
        Envia via <strong>Multicaixa Express</strong> para o número
        <button type="button" onClick={() => navigator.clipboard?.writeText('937555618').catch(() => null)} className="mx-1.5 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-black tabular-nums text-[#102b46] shadow-sm transition hover:bg-blue-50" title="Copiar número">
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

    <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-[#2878d0] px-4 py-3 font-semibold text-white transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60">
      {loading ? 'A enviar…' : 'Enviar comprovativo para confirmação'}
    </button>
    <p className="text-center text-xs text-[#708195]">A tua conta é activada logo que o pagamento for confirmado pela equipa.</p>
  </form>;
}
