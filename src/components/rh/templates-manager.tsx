'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Template = { id: string; name: string; type: string; body: string; isActive: boolean };

const TYPE_LABEL: Record<string, string> = {
  CONTRATO: 'Contrato', DECLARACAO_TRABALHO: 'Declaração de trabalho', DECLARACAO_RENDIMENTOS: 'Declaração de rendimentos',
  DECLARACAO_FERIAS: 'Declaração de férias', OUTRO: 'Outro',
};

export function TemplatesManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('CONTRATO');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/rh/document-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      setName(''); setBody('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Machine Documents</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Modelos</h1>
        <p className="mt-1 text-sm text-[#607286]">Modelos por empresa com variáveis documentais. A validação jurídica é obrigatória antes de emitir.</p>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="tpl-name" className="app-label">Nome *</label><input id="tpl-name" className="app-input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label htmlFor="tpl-type" className="app-label">Tipo</label><select id="tpl-type" className="app-input" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className="mt-3">
          <label htmlFor="tpl-body" className="app-label">Conteúdo *</label>
          <textarea id="tpl-body" className="app-input min-h-40 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Ex.: A empresa {{empresa_nome}} (NIF {{empresa_nif}}) declara que {{funcionario_nome}}, BI {{funcionario_bi}}, exerce a função de {{cargo}} em {{departamento}} desde {{data_inicio}}.'} required />
          <p className="mt-1 text-xs text-[#708195]">Variáveis: {'{{empresa_nome}}'}, {'{{empresa_nif}}'}, {'{{funcionario_nome}}'}, {'{{funcionario_bi}}'}, {'{{cargo}}'}, {'{{departamento}}'}, {'{{salario_base}}'}, {'{{data_inicio}}'}, {'{{data_fim}}'}.</p>
        </div>
        {error && <p role="alert" className="mt-2 text-xs font-medium text-[#a83939]">{error}</p>}
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : 'Guardar modelo'}</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[560px]">
          <thead><tr><th>Modelo</th><th>Tipo</th><th>Estado</th><th>Variáveis</th></tr></thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{template.name}</td>
                <td>{TYPE_LABEL[template.type] ?? template.type}</td>
                <td><span className="rounded-full bg-[#eff9f4] px-2 py-0.5 text-[11px] font-semibold text-[#267256]">{template.isActive ? 'Activo' : 'Inactivo'}</span></td>
                <td className="text-xs text-[#607286]">{(template.body.match(/\{\{[a-z_]+\}\}/g) ?? []).length} referências</td>
              </tr>
            ))}
            {templates.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há modelos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
