'use client';

import { useState, type FormEvent } from 'react';

import { FormError } from '@/components/rh/form-kit';
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
        <p className="text-sm text-[#708195]">Machine RH · Assistente</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Rascunhos com IA</h1>
        <p className="mt-1 text-sm text-[#607286]">Gera rascunhos de documentos. Revisão humana obrigatória antes de emitir.</p>
      </div>

      <div className={`rounded-xl border p-4 text-sm ${configured ? 'border-[#cbe8dc] bg-[#eff9f4] text-[#267256]' : 'border-[#f0e0b8] bg-[#fffbef] text-[#8a5a00]'}`}>
        {configured
          ? <>Assistente activo via <strong>{provider}</strong> (nível gratuito). Limite de 10 pedidos/minuto por utilizador.</>
          : <>Assistente não configurado. Crie uma chave gratuita na Groq e defina <code>GROQ_API_KEY</code>; opcionalmente <code>OPENROUTER_API_KEY</code> como fallback.</>}
      </div>

      <form onSubmit={generate} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="ai-type" className="app-label">Tipo</label><select id="ai-type" className="app-input" value={type} onChange={(e) => setType(e.target.value)}><option value="DECLARACAO_TRABALHO">Declaração de trabalho</option><option value="CONTRATO">Contrato</option><option value="DECLARACAO_FERIAS">Declaração de férias</option><option value="OUTRO">Outro</option></select></div>
          <div><label htmlFor="ai-context" className="app-label">Contexto factual</label><input id="ai-context" className="app-input" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Ex.: João Silva, técnico, desde 01/02/2025, NIF da empresa…" /></div>
        </div>
        <div className="mt-3">
          <label htmlFor="ai-instruction" className="app-label">O que deve ser escrito *</label>
          <textarea id="ai-instruction" className="app-input min-h-32" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex.: Declaração de trabalho para efeitos bancários, com função, data de admissão e salário base." required />
        </div>
        <FormError>{error}</FormError>
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={loading || !configured} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'A gerar…' : 'Gerar rascunho'}</button>
        </div>
      </form>

      {result && (
        <section className="rounded-xl border border-[#e1e8f0] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#1c2d3f]">Rascunho</h2>
            <button type="button" onClick={() => navigator.clipboard?.writeText(result)} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">Copiar</button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1c2d3f]">{result}</pre>
          <p className="mt-3 text-xs text-[#8a5a00]">Rascunho gerado por IA. Reveja factos, valores e conformidade antes de usar.</p>
        </section>
      )}
    </div>
  );
}
