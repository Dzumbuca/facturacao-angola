'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormError } from '@/components/rh/form-kit';
type Document = {
  id: string; title: string; status: string; type: string; createdAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
};
type Template = { id: string; name: string; type: string };
type Employee = { id: string; firstName: string; lastName: string; employeeNumber: string };

const STATUS_LABEL: Record<string, string> = { RASCUNHO: 'Rascunho', EMITIDO: 'Emitido', ANULADO: 'Anulado' };
const STATUS_TONE: Record<string, string> = {
  RASCUNHO: 'bg-[#fff7e6] text-[#8a5a00]',
  EMITIDO: 'bg-[#eff9f4] text-[#267256]',
  ANULADO: 'bg-[#fdf3f3] text-[#a83939]',
};

export function DocumentsManager({ documents, templates, employees }: {
  documents: Document[]; templates: Template[]; employees: Employee[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/rh/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, employeeId: employeeId || null, title }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível gerar.');
      setMessage('Documento gerado como rascunho. Reveja antes de emitir.');
      setTitle('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, status: 'EMITIDO' | 'ANULADO') {
    setError(''); setMessage('');
    try {
      const response = await fetch(`/api/rh/documents/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível actualizar.');
      setMessage(status === 'EMITIDO' ? 'Documento emitido.' : 'Documento anulado.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Machine Documents</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Documentos</h1>
        <p className="mt-1 text-sm text-[#607286]">Gere rascunhos a partir de modelos, pré-visualize em PDF e emita após validação humana.</p>
      </div>

      <form onSubmit={generate} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label htmlFor="doc-template" className="app-label">Modelo *</label><select id="doc-template" className="app-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required><option value="">Selecionar</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>
          <div><label htmlFor="doc-employee" className="app-label">Funcionário</label><select id="doc-employee" className="app-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Sem funcionário</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeNumber})</option>)}</select></div>
          <div><label htmlFor="doc-title" className="app-label">Título (opcional)</label><input id="doc-title" className="app-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Usa o nome do modelo" /></div>
        </div>
        {message && <p role="status" className="mt-3 rounded-lg bg-[#eff9f4] px-3 py-2 text-sm text-[#267256]">{message}</p>}
        <FormError>{error}</FormError>
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={saving || templates.length === 0} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'A gerar…' : 'Gerar rascunho'}</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[820px]">
          <thead><tr><th>Documento</th><th>Funcionário</th><th>Estado</th><th>Criado</th><th>Acções</th></tr></thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td data-mobile-primary><span className="block font-semibold text-[#1c2d3f]">{document.title}</span><span className="block text-xs text-[#708195]">{document.type}</span></td>
                <td>{document.employee ? `${document.employee.firstName} ${document.employee.lastName}` : '—'}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[document.status] ?? ''}`}>{STATUS_LABEL[document.status] ?? document.status}</span></td>
                <td className="tabular-nums text-xs">{new Date(document.createdAt).toLocaleDateString('pt-AO')}</td>
                <td data-mobile-actions>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/rh/documents/${document.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">PDF</a>
                    <a href={`/api/rh/documents/${document.id}/docx`} className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#52667a]">DOCX</a>
                    {document.status === 'RASCUNHO' && (
                      <>
                        <button type="button" onClick={() => decide(document.id, 'EMITIDO')} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256]">Emitir</button>
                        <button type="button" onClick={() => decide(document.id, 'ANULADO')} className="min-h-9 rounded-lg border border-[#f0d3d3] px-3 text-xs font-semibold text-[#a83939]">Anular</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {documents.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há documentos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
