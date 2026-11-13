'use client';

import { useEffect, useMemo, useState } from 'react';
import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
import { DOCUMENT_TYPES, documentTypeById, buildInstruction, CATEGORIES, type DocumentField } from '@/lib/rh-ai-studio';

type Step = 'choose' | 'form' | 'editor';
type StoredDraft = { id: string; title: string; typeId: string; content: string; updatedAt: number };

const STORAGE_KEY = 'machine-rh-ai-studio-drafts';
const loadDrafts = (): StoredDraft[] => {
  if (typeof window === 'undefined') return [];
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? (JSON.parse(raw) as StoredDraft[]) : []; } catch { return []; }
};
const saveDrafts = (drafts: StoredDraft[]) => {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(-30))); } catch { /* ignore */ }
};
const exportText = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
};

function Field({ field, value, onChange }: { field: DocumentField; value: string; onChange: (key: string, value: string) => void }) {
  const common = 'app-input';
  const id = `field-${field.key}`;
  if (field.kind === 'textarea') {
    return <textarea id={id} className={`${common} min-h-24`} value={value} placeholder={field.placeholder} onChange={(e) => onChange(field.key, e.target.value)} />;
  }
  if (field.kind === 'select') {
    return <select id={id} className={common} value={value} onChange={(e) => onChange(field.key, e.target.value)}>
      <option value="">Seleccionar…</option>
      {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>;
  }
  return <input id={id} className={common} type={field.kind ?? 'text'} value={value} placeholder={field.placeholder} onChange={(e) => onChange(field.key, e.target.value)} />;
}

export function RhAiStudio({ configured, provider }: { configured: boolean; provider: string | null }) {
  const [step, setStep] = useState<Step>('choose');
  const [typeId, setTypeId] = useState(DOCUMENT_TYPES[0].id);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<StoredDraft[]>([]);

  useEffect(() => { setDrafts(loadDrafts()); }, []);

  const chosen = documentTypeById(typeId) ?? DOCUMENT_TYPES[0];
  const visibleTypes = useMemo(() => DOCUMENT_TYPES.filter((t) => !categoryFilter || t.category === categoryFilter), [categoryFilter]);

  const setValue = (key: string, value: string) => setValues((v) => {
    const next = { ...v, [key]: value };
    // Para cidadãos angolanos, NIF pode coincidir com o BI.
    if (key === 'funcionarioBi' && !v.funcionarioNif) next.funcionarioNif = value;
    if (key === 'funcionarioNif' && value && !v.funcionarioNif) { /* utilizador apagou NIF manual: manter*/ }
    return next;
  });

  async function generate() {
    setLoading(true); setError(''); setResult('');
    try {
      const generated = buildInstruction(chosen, values);
      const response = await fetch('/api/rh/ai/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: generated, context: instruction || chosen.label, type: chosen.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível gerar.');
      const text: string = data?.text ?? '';
      setResult(text);
      setTitle(chosen.label);
      const draft: StoredDraft = { id: `draft-${Date.now()}`, title: chosen.label, typeId: chosen.id, content: text, updatedAt: Date.now() };
      const nextDrafts = [draft, ...drafts].slice(0, 30);
      setDrafts(nextDrafts); saveDrafts(nextDrafts);
      setStep('editor');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const saveEdit = () => {
    const next = drafts.map((d) => d.title === title || d.typeId === typeId ? { ...d, title, content: result, updatedAt: Date.now() } : d);
    if (!next.some((d) => d.title === title && d.content === result)) {
      next.unshift({ id: `draft-${Date.now()}`, title, typeId, content: result, updatedAt: Date.now() });
    }
    const trimmed = next.slice(0, 30);
    setDrafts(trimmed); saveDrafts(trimmed);
  };

  const duplicate = () => {
    const draft: StoredDraft = { id: `draft-${Date.now()}`, title: `${title} (cópia)`, typeId, content: result, updatedAt: Date.now() };
    const next = [draft, ...drafts].slice(0, 30);
    setDrafts(next); saveDrafts(next);
  };

  const download = async (fmt: 'docx' | 'pdf' | 'txt' | 'md') => {
    if (fmt === 'txt' || fmt === 'md') {
      exportText(`${title}.${fmt === 'md' ? 'md' : 'txt'}`, result, fmt === 'md' ? 'text/markdown' : 'text/plain');
      return;
    }
    const response = await fetch('/api/assistant/document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body: result, format: fmt }),
    });
    if (!response.ok) throw new Error('export-failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w\- ]/g, '').slice(0, 60) || 'documento'}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setStep('choose'); setInstruction(''); setResult(''); setTitle(''); setError(''); };

  if (step === 'choose') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-[#708195]">Machine RH · Assistente IA</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Estúdio de Documentos IA</h1>
          <p className="mt-1 text-sm text-[#607286]">Cria documentos profissionais em 5 passos: escolher → introduzir dados → gerar → rever e editar → descarregar. Limites do Groq: 10 pedidos/minuto por utilizador.</p>
        </div>
        <div className={`rounded-xl border p-3 text-xs ${configured ? 'border-[#cbe8dc] bg-[#eff9f4] text-[#267256]' : 'border-[#f0e0b8] bg-[#fffbef] text-[#8a5a00]'}`}>{configured ? <>Activo via <strong>{provider}</strong>.</> : <>IA não configurada. Defina <code>GROQ_API_KEY</code>.</>}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategoryFilter('')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${!categoryFilter ? 'border-[#021f87] bg-[#021f87] text-white' : 'border-[#d4e0ea] text-[#3c4f66]'}`}>Todas</button>
          {CATEGORIES.map((c) => <button key={c.value} type="button" onClick={() => setCategoryFilter(categoryFilter === c.value ? '' : c.value)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${categoryFilter === c.value ? 'border-[#021f87] bg-[#021f87] text-white' : 'border-[#d4e0ea] text-[#3c4f66]'}`}>{c.label}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleTypes.map((t) => (
            <button key={t.id} type="button" onClick={() => { setTypeId(t.id); setStep('form'); }} className="rounded-xl border border-[#dfe7f0] bg-white p-3 text-left transition hover:border-[#021f87]/40 hover:bg-[#f7faff]">
              <p className="text-sm font-semibold text-[#1c2d3f]">{t.label}</p>
              <p className="mt-0.5 text-xs text-[#708195]">{t.description}</p>
              <p className="mt-2 text-[10px] uppercase tracking-[.12em] text-[#8aa1bd]">Ex.: {t.example}</p>
            </button>
          ))}
        </div>

        {drafts.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-[.14em] text-[#708195]">Os meus rascunhos ({drafts.length})</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {drafts.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-xl border border-[#e1e8f0] bg-white p-3">
                  <div className="min-w-0"><p className="truncate text-xs font-semibold text-[#1c2d3f]">{d.title}</p></div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => { setTypeId(d.typeId); setResult(d.content); setTitle(d.title); setStep('editor'); }} className="text-[10px] font-semibold text-[#021f87] hover:underline">Abrir</button>
                    <button type="button" onClick={() => { const next = drafts.filter((x) => x.id !== d.id); setDrafts(next); saveDrafts(next); }} className="text-[10px] font-semibold text-[#a83939] hover:underline">Eliminar</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setStep('choose')} className="text-xs font-semibold text-[#021f87]">← Voltar</button>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#708195]">{chosen.label}</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void generate(); }} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <FormSection title="Dados do documento">
            <div className="grid gap-3 sm:grid-cols-2">
              {chosen.fields.map((field) => (
                <div key={field.key} className={field.kind === 'textarea' ? 'sm:col-span-2' : ''}>
                  <FormField label={field.label} name={`studio-${field.key}`} required={!field.optional}>
                    <Field field={field} value={values[field.key] ?? ''} onChange={setValue} />
                  </FormField>
                </div>
              ))}
            </div>
            <FormError>{error}</FormError>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={reset} className="text-xs font-semibold text-[#708195] hover:underline">Descartar</button>
              <FormActions saving={loading} disabled={!configured || loading} onCancel={() => {}} saveLabel={loading ? 'A gerar…' : 'Gerar com IA'} />
            </div>
          </FormSection>
        </form>
      </div>
    );
  }

  const charCount = result.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setStep('form')} className="text-xs font-semibold text-[#021f87]">← Voltar ao formulário</button>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#708195]">{chosen.label} · Rascunho</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#d4e0ea] px-3 py-2 text-sm font-semibold text-[#1c2d3f] outline-none focus:border-[#021f87]" maxLength={160} />
        <div className="flex gap-2">
          <button type="button" onClick={duplicate} className="rounded-lg border border-[#d4e0ea] px-3 py-2 text-xs font-semibold text-[#3c4f66] hover:bg-[#f4f7fb]">Duplicar</button>
          <button type="button" onClick={saveEdit} className="rounded-lg border border-[#d4e0ea] px-3 py-2 text-xs font-semibold text-[#3c4f66] hover:bg-[#f4f7fb]">Guardar</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label htmlFor="studio-editor" className="text-xs font-bold uppercase tracking-[.14em] text-[#708195]">Editor</label>
          <textarea id="studio-editor" value={result} onChange={(e) => setResult(e.target.value)} className="mt-1 h-96 w-full resize-none rounded-xl border border-[#d4e0ea] bg-white px-3 py-2 font-mono text-xs leading-5 text-[#24364d] outline-none focus:border-[#021f87]" spellCheck={false} />
          <p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#94a3b8]">{charCount} caracteres · negrito **texto**, títulos #/##, listas -, tabelas |</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#708195]">Pré-visualização A4</p>
          <div className="mt-1 h-96 overflow-y-auto rounded-xl border border-[#e1e8f0] bg-[#fdfdfd] px-6 py-4 text-[#1c2d3f]"><pre className="whitespace-pre-wrap font-serif text-[11px] leading-6">{result}</pre></div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e1e8f0] pt-3">
        <p className="text-xs text-[#8a5a00]">Rascunho gerado por IA. Reveja factos, conformidade e assinaturas antes de emitir.</p>
        <div className="flex flex-wrap gap-2">
          {(['docx', 'pdf', 'txt', 'md'] as const).map((fmt) => <button key={fmt} type="button" onClick={() => download(fmt)} className="rounded-lg border border-[#c9d8fb] bg-white px-3 py-2 text-xs font-semibold text-[#021f87] hover:bg-[#eef2ff]">{fmt === 'docx' ? 'Word' : fmt === 'md' ? 'Markdown' : fmt.toUpperCase()}</button>)}
        </div>
      </div>
    </div>
  );
}
