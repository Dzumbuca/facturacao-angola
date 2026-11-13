'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { RhModuleHero } from '@/components/rh/premium-kit';
import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
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
      <RhModuleHero
        eyebrow="Machine Documents"
        title="Documentos"
        description="Gere rascunhos a partir de modelos, pré-visualize em PDF e emita apenas após a validação humana. Nenhum documento sai sem que alguém o aprove."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 13h4"/><path d="M10 17h4"/></svg>}
      />

      <form onSubmit={generate} className="rounded-xl border border-[var(--line)] bg-white p-4">
        <FormSection title="Gerar documento">
          <div>
            <FormField label="Modelo" name="doc-template" required>
              <select id="doc-template" className="ds-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
                <option value="">Selecionar</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </FormField>
          </div>
          <div>
            <FormField label="Funcionário" name="doc-employee">
              <select id="doc-employee" className="ds-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Sem funcionário</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeNumber})</option>)}
              </select>
            </FormField>
          </div>
          <div>
            <FormField label="Título" name="doc-title" hint="Usa o nome do modelo"><input id="doc-title" className="ds-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Usa o nome do modelo" /></FormField>
          </div>
        </FormSection>
        {message && <p role="status" className="mt-3 rounded-lg bg-[#eff9f4] px-3 py-2 text-sm text-[#267256]">{message}</p>}
        <FormError>{error}</FormError>
        <div className="mt-3 flex justify-end">
          <FormActions saving={saving} disabled={templates.length === 0} onCancel={() => {}} saveLabel={saving ? 'A gerar…' : 'Gerar rascunho'} />
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
        <table className="data-table min-w-[820px]">
          <thead><tr><th>Documento</th><th>Funcionário</th><th>Estado</th><th>Criado</th><th>Acções</th></tr></thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td data-mobile-primary><span className="block font-semibold text-[var(--text)]">{document.title}</span><span className="block text-xs text-[var(--text-muted)]">{document.type}</span></td>
                <td>{document.employee ? `${document.employee.firstName} ${document.employee.lastName}` : '—'}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[document.status] ?? ''}`}>{STATUS_LABEL[document.status] ?? document.status}</span></td>
                <td className="tabular-nums text-xs">{new Date(document.createdAt).toLocaleDateString('pt-AO')}</td>
                <td data-mobile-actions>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/rh/documents/${document.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue)]">PDF</a>
                    <a href={`/api/rh/documents/${document.id}/docx`} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[#52667a]">DOCX</a>
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
            {documents.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-[#7094aa]">Ainda não há documentos gerados pelo sistema.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
