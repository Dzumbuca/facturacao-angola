'use client';

import { useState, type FormEvent } from 'react';

import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
export function AiManager({ configured, provider }: { configured: boolean; provider: string | null }) {
  const [instruction, setInstruction] = useState('');
  const [context, setContext] = useState('');
  const [type, setType] = useState('DECLARACAO_TRABALHO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(''); setResult('');
    try {
      const response = await fetch('/api/rh/ai/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, context, type }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível gerar.');
      setResult(data.text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[var(--text-muted)]">Machine RH · Assistente</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Rascunhos com IA</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Gera rascunhos de documentos. Revisão humana obrigatória antes de emitir.</p>
      </div>

      <div className={`rounded-xl border p-4 text-sm ${configured ? 'border-[#cbe8dc] bg-[#eff9f4] text-[#267256]' : 'border-[#f0e0b8] bg-[#fffbef] text-[#8a5a00]'}`}>
        {configured
          ? <>Assistente activo via <strong>{provider}</strong> (nível gratuito). Limite de 10 pedidos/minuto por utilizador.</>
          : <>Assistente não configurado. Crie uma chave gratuita na Groq e defina <code>GROQ_API_KEY</code>; opcionalmente <code>OPENROUTER_API_KEY</code> como fallback.</>}
      </div>

      <form onSubmit={generate} className="form-card-light rounded-xl border border-[#e6eaf0] p-4">
        <FormSection title="Novo rascunho">
          <div>
            <FormField label="Tipo" name="ai-type">
              <select id="ai-type" className="ds-input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="DECLARACAO_TRABALHO">Declaração de trabalho</option>
                <option value="CONTRATO">Contrato</option>
                <option value="DECLARACAO_FERIAS">Declaração de férias</option>
                <option value="OUTRO">Outro</option>
              </select>
            </FormField>
          </div>
          <div>
            <FormField label="Contexto factual" name="ai-context" hint="Dados concretos para o modelo">
              <input id="ai-context" className="ds-input" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Ex.: João Silva, técnico, desde 01/02/2025, NIF da empresa…" />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="O que deve ser escrito" name="ai-instruction" required>
              <textarea id="ai-instruction" className="app-input min-h-32" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex.: Declaração de trabalho para efeitos bancários, com função, data de admissão e salário base." required />
            </FormField>
          </div>
          <FormError>{error}</FormError>
          <div className="sm:col-span-2">
            <FormActions saving={loading} disabled={!configured} onCancel={() => {}} saveLabel={loading ? 'A gerar…' : 'Gerar rascunho'} />
          </div>
        </FormSection>
      </form>

      {result && (
        <section className="form-card-light rounded-xl border border-[#e6eaf0] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--text)]">Rascunho</h2>
            <button type="button" onClick={() => navigator.clipboard?.writeText(result)} className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue)]">Copiar</button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--text)]">{result}</pre>
          <p className="mt-3 text-xs text-[#8a5a00]">Rascunho gerado por IA. Reveja factos, valores e conformidade antes de usar.</p>
        </section>
      )}
    </div>
  );
}
