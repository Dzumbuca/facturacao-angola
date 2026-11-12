'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormError } from '@/components/rh/form-kit';
type Template = { id: string; name: string; type: string; body: string; isActive: boolean; version: number; legalStatus?: string };

const TYPE_LABEL: Record<string, string> = {
  CONTRATO: 'Contrato', DECLARACAO_TRABALHO: 'Declaração de trabalho', DECLARACAO_RENDIMENTOS: 'Declaração de rendimentos',
  DECLARACAO_FERIAS: 'Declaração de férias', OUTRO: 'Outro',
};

export function TemplatesManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('CONTRATO');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [history, setHistory] = useState<{ name: string; items: any[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setEditing(null); setName(''); setBody('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const response = await fetch(editing ? `/api/rh/document-templates/${editing.id}` : '/api/rh/document-templates', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function validateTemplate(template: Template) {
    const documentUrl = window.prompt('URL da evidência documental (parecer ou documento):');
    const validatedByName = window.prompt('Validado por (nome e função):');
    if (!documentUrl || !validatedByName) return;
    const response = await fetch('/api/rh/document-templates/legal-validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, documentUrl, validatedByName }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) window.alert(data?.error ?? 'Não foi possível validar.');
    else router.refresh();
  }

  async function openHistory(template: Template) {
    try {
      const response = await fetch(`/api/rh/document-templates/${template.id}/versions`);
      const items = response.ok ? await response.json() : [];
      setHistory({ name: template.name, items });
    } catch {
      setHistory({ name: template.name, items: [] });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Machine Documents</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Modelos</h1>
        <p className="mt-1 text-sm text-[#607286]">Cada edição cria uma versão imutável. A validação jurídica é obrigatória antes de emitir.</p>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1c2d3f]">{editing ? `Editar modelo (cria v${editing.version + 1})` : 'Novo modelo'}</h2>
          {editing && <button type="button" onClick={reset} className="text-xs font-semibold text-[#52667a]">Cancelar</button>}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="tpl-name" className="app-label">Nome *</label><input id="tpl-name" className="app-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label htmlFor="tpl-type" className="app-label">Tipo</label><select id="tpl-type" className="app-input" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className="mt-3">
          <label htmlFor="tpl-body" className="app-label">Conteúdo *</label>
          <textarea id="tpl-body" className="app-input min-h-40 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Ex.: A empresa {{empresa_nome}} (NIF {{empresa_nif}}) declara que {{funcionario_nome}}, BI {{funcionario_bi}}, exerce a função de {{cargo}}.'} required />
          <p className="mt-1 text-xs text-[#708195]">Variáveis: {'{{empresa_nome}}'}, {'{{empresa_nif}}'}, {'{{funcionario_nome}}'}, {'{{funcionario_bi}}'}, {'{{cargo}}'}, {'{{departamento}}'}, {'{{salario_base}}'}, {'{{data_inicio}}'}, {'{{data_fim}}'}.</p>
        </div>
        <FormError>{error}</FormError>
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : editing ? 'Guardar nova versão' : 'Guardar modelo'}</button>
        </div>
      </form>

      {history && (
        <section className="rounded-xl border border-[#e1e8f0] bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1c2d3f]">Histórico — {history.name}</h2>
            <button type="button" onClick={() => setHistory(null)} className="text-xs font-semibold text-[#52667a]">Fechar</button>
          </div>
          <ul className="mt-3 divide-y divide-[#eef2f6]">
            {history.items.map((version: any) => (
              <li key={version.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-semibold">v{version.version}</span>
                <span className="text-xs text-[#708195]">{new Date(version.createdAt).toLocaleString('pt-AO')}</span>
              </li>
            ))}
            {history.items.length === 0 && <li className="py-2 text-sm text-[#708195]">Sem versões.</li>}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[720px]">
          <thead><tr><th>Modelo</th><th>Tipo</th><th>Versão</th><th>Jurídico</th><th>Estado</th><th>Acções</th></tr></thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{template.name}</td>
                <td>{TYPE_LABEL[template.type] ?? template.type}</td>
                <td className="tabular-nums">v{template.version}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${template.legalStatus === 'VALIDADO' ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#fff7e6] text-[#8a5a00]'}`}>{template.legalStatus ?? 'PENDENTE'}</span></td>
                <td><span className="rounded-full bg-[#eff9f4] px-2 py-0.5 text-[11px] font-semibold text-[#267256]">{template.isActive ? 'Activo' : 'Inactivo'}</span></td>
                <td data-mobile-actions>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setEditing(template); setName(template.name); setType(template.type); setBody(template.body); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">Editar</button>
                    <button type="button" onClick={() => validateTemplate(template)} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">Validar</button>
                    <button type="button" onClick={() => openHistory(template)} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#52667a]">Histórico</button>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há modelos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
