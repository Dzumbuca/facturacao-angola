'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError, CalendarField } from '@/components/rh/form-kit';
type RuleSet = { id: string; name: string; effectiveFrom: string; status: string; legalStatus?: string };
type Run = {
  id: string; period: string; status: string; totalGross: number; totalNet: number;
  totalInss: number; totalIrt: number; ruleset: { name: string } | null; _count: { payslips: number };
};

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', CALCULADO: 'Calculado', EM_REVISAO: 'Em revisão', APROVADO: 'Aprovado',
  PENDENTE_PAGAMENTO: 'Pendente pagamento', PAGO: 'Pago', CANCELADO: 'Cancelado',
};
const STATUS_TONE: Record<string, string> = {
  CALCULADO: 'bg-[#eef4ff] text-[#021f87]', EM_REVISAO: 'bg-[#fff7e6] text-[#8a5a00]',
  APROVADO: 'bg-[#eff9f4] text-[#267256]', PENDENTE_PAGAMENTO: 'bg-[#fff7e6] text-[#8a5a00]',
  PAGO: 'bg-[#eff9f4] text-[#267256]', CANCELADO: 'bg-[#fdf3f3] text-[#a83939]',
};

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export function PayrollManager({ rulesets, runs }: { rulesets: RuleSet[]; runs: Run[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'runs' | 'rules'>('runs');
  async function validateRuleset(ruleset: RuleSet) {
    const documentUrl = window.prompt('URL da evidência documental (parecer ou documento):');
    const validatedByName = window.prompt('Validado por (nome e função):');
    if (!documentUrl || !validatedByName) return;
    const response = await fetch('/api/rh/payroll/legal-validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rulesetId: ruleset.id, documentUrl, validatedByName }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) window.alert(data?.error ?? 'Não foi possível validar.');
    else router.refresh();
  }
  const [period, setPeriod] = useState('');
  const [rulesetId, setRulesetId] = useState(rulesets[0]?.id ?? '');
  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [inssEmployeeRate, setInssEmployeeRate] = useState('');
  const [inssEmployerRate, setInssEmployerRate] = useState('');
  const [foodAllowance, setFoodAllowance] = useState('');
  const [transportAllowance, setTransportAllowance] = useState('');
  const [brackets, setBrackets] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/rh/payroll/runs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, rulesetId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível calcular.');
      setMessage(`Processamento de ${period} calculado.`);
      setPeriod('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function createRuleset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      let parsedBrackets: unknown;
      try { parsedBrackets = JSON.parse(brackets); } catch { throw new Error('Escalões IRT em JSON inválido.'); }
      const response = await fetch('/api/rh/payroll/rulesets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, effectiveFrom,
          inssEmployeeRate, inssEmployerRate, foodAllowance, transportAllowance,
          irtBrackets: parsedBrackets,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      setMessage('Conjunto de regras criado.');
      setName(''); setBrackets('');
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
      const response = await fetch(`/api/rh/payroll/runs/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Transição inválida.');
      setMessage(`Processamento actualizado para ${STATUS_LABEL[status] ?? status}.`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Machine Payroll</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Processamento salarial</h1>
        <p className="mt-1 text-sm text-[#607286]">Regras configuráveis e versionadas. Nenhuma taxa legal está fixada no código.</p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('runs')} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${tab === 'runs' ? 'bg-[#021f87] text-white' : 'border border-[#cdddeb] bg-white text-[#52667a]'}`}>Processamentos</button>
        <button type="button" onClick={() => setTab('rules')} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${tab === 'rules' ? 'bg-[#021f87] text-white' : 'border border-[#cdddeb] bg-white text-[#52667a]'}`}>Regras salariais</button>
      </div>

      <FormError>{error}</FormError>
      {message && <p role="status" className="rounded-lg bg-[#eff9f4] px-3 py-2 text-sm text-[#267256]">{message}</p>}

      {tab === 'runs' && (
        <>
          <form onSubmit={calculate} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
            <h2 className="text-sm font-bold text-[#1c2d3f]">Novo processamento</h2>
            {rulesets.length === 0 ? (
              <p className="mt-2 text-sm text-[#8a5a00]">Crie primeiro um conjunto de regras salariais (separador ao lado).</p>
            ) : (
              <FormSection title="Período de processamento">
                <FormField label="Período" name="run-period" required><input id="run-period" type="month" className="app-input" value={period} onChange={(e) => setPeriod(e.target.value)} required /></FormField>
                <FormField label="Regras salariais" name="run-ruleset" required><select id="run-ruleset" className="app-input" value={rulesetId} onChange={(e) => setRulesetId(e.target.value)} required>{rulesets.map((ruleset) => <option key={ruleset.id} value={ruleset.id}>{ruleset.name}</option>)}</select></FormField>
                <div className="flex items-end"><FormActions saving={saving} onCancel={() => {}} saveLabel={saving ? 'A calcular…' : 'Calcular folha'} /></div>
              </FormSection>
            )}
          </form>

          <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
            <table className="data-table min-w-[820px]">
              <thead><tr><th>Período</th><th>Regras</th><th>Bruto</th><th>INSS</th><th>IRT</th><th>Líquido</th><th>Estado</th><th>Acções</th></tr></thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td data-mobile-primary className="font-semibold tabular-nums text-[#1c2d3f]">{run.period}</td>
                    <td className="text-xs">{run.ruleset?.name ?? '—'}</td>
                    <td className="tabular-nums">{money(run.totalGross)}</td>
                    <td className="tabular-nums">{money(run.totalInss)}</td>
                    <td className="tabular-nums">{money(run.totalIrt)}</td>
                    <td className="tabular-nums font-semibold">{money(run.totalNet)}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[run.status] ?? ''}`}>{STATUS_LABEL[run.status] ?? run.status}</span></td>
                    <td data-mobile-actions>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/rh/processamento-salarial/${run.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">Ver</Link>
                        {(run.status === 'CALCULADO' || run.status === 'EM_REVISAO') && <button type="button" onClick={() => transition(run.id, 'APROVADO')} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256]">Aprovar</button>}
                        {run.status === 'APROVADO' && <button type="button" onClick={() => transition(run.id, 'PENDENTE_PAGAMENTO')} className="min-h-9 rounded-lg border border-[#e6d29a] px-3 text-xs font-semibold text-[#8a5a00]">Preparar pagamento</button>}
                        {run.status === 'PENDENTE_PAGAMENTO' && <button type="button" onClick={() => transition(run.id, 'PAGO')} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256]">Marcar pago</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há processamentos.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'rules' && (
        <>
          <form onSubmit={createRuleset} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
            <h2 className="text-sm font-bold text-[#1c2d3f]">Novo conjunto de regras</h2>
            <FormSection title="Definição das regras" description="Os valores são definidos pela empresa após validação jurídica. Nada fica VALIDADO sem evidência documental.">
              <div className="sm:col-span-2"><FormField label="Nome" name="rule-name" required><input id="rule-name" className="app-input" value={name} onChange={(e) => setName(e.target.value)} required /></FormField></div>
              <div><FormField label="Vigência" name="rule-from" required><CalendarField id="rule-from" name="rule-from" value={effectiveFrom} onChange={setEffectiveFrom} required /></FormField></div>
              <div><FormField label="INSS trabalhador (%)" name="rule-inss-emp"><input id="rule-inss-emp" type="number" min="0" max="100" step="0.01" className="app-input" value={inssEmployeeRate} onChange={(e) => setInssEmployeeRate(e.target.value)} required /></FormField></div>
              <div><FormField label="INSS entidade (%)" name="rule-inss-empr"><input id="rule-inss-empr" type="number" min="0" max="100" step="0.01" className="app-input" value={inssEmployerRate} onChange={(e) => setInssEmployerRate(e.target.value)} required /></FormField></div>
              <div><FormField label="Subsídio alimentação (Kz)" name="rule-food"><input id="rule-food" type="number" min="0" step="0.01" className="app-input" value={foodAllowance} onChange={(e) => setFoodAllowance(e.target.value)} required /></FormField></div>
              <div><FormField label="Subsídio transporte (Kz)" name="rule-transport"><input id="rule-transport" type="number" min="0" step="0.01" className="app-input" value={transportAllowance} onChange={(e) => setTransportAllowance(e.target.value)} required /></FormField></div>
            </FormSection>
            <div className="mt-3">
              <FormField label="Escalões IRT (JSON)" name="rule-brackets" required hint="Cada escalão: limite superior (`upTo`, `null` no último), taxa e dedução."><textarea id="rule-brackets" className="app-input min-h-28 font-mono text-xs" value={brackets} onChange={(e) => setBrackets(e.target.value)} placeholder={'[{"upTo":100000,"rate":0,"deduction":0},{"upTo":null,"rate":10,"deduction":0}]'} required /></FormField>
            </div>
            <div className="mt-3"><FormActions saving={saving} onCancel={() => {}} saveLabel={saving ? 'A guardar…' : 'Guardar regras'} /></div>
          </form>

          <div className="rounded-xl border border-[#e1e8f0] bg-white">
            <ul className="divide-y divide-[#eef2f6]">
              {rulesets.map((ruleset) => (
                <li key={ruleset.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div><p className="text-sm font-semibold text-[#1c2d3f]">{ruleset.name}</p><p className="text-xs text-[#708195]">Vigência {new Date(ruleset.effectiveFrom).toLocaleDateString('pt-AO')}</p></div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ruleset.legalStatus === 'VALIDADO' ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#fff7e6] text-[#8a5a00]'}`}>{ruleset.legalStatus ?? 'PENDENTE'}</span>
                    <button type="button" onClick={() => validateRuleset(ruleset)} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">Validar</button>
                  </div>
                </li>
              ))}
              {rulesets.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#708195]">Ainda não há regras.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
