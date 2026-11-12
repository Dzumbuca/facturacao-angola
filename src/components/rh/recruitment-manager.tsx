'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
const STATUS_LABEL: Record<string, string> = {
  ABERTA: 'Aberta', ENCERRADA: 'Encerrada', CANCELADA: 'Cancelada',
  RECEBIDA: 'Recebida', TRIAGEM: 'Triagem', ENTREVISTA: 'Entrevista',
  AVALIACAO: 'Avaliação', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado', ADMITIDO: 'Admitido',
};

type Opening = { id: string; title: string; departmentName?: string | null; positionTitle?: string | null; openings: number; closesAt: string | null; status: string; candidateCount: number };
type Candidate = { id: string; firstName: string; lastName: string; email: string; status: string; openingTitle: string; openingId: string };

export function RecruitmentManager({ openings, candidates, departments, positions }: { openings: Opening[]; candidates: Candidate[]; departments: Array<{ id: string; name: string }>; positions: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string>(openings[0]?.id ?? '');
  const [candidateStatus, setCandidateStatus] = useState<string>('ALL');

  async function createOpening(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/rh/recruitment/openings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(form.get('title') ?? ''),
          departmentId: String(form.get('departmentId') ?? '') || undefined,
          positionId: String(form.get('positionId') ?? '') || undefined,
          openings: Number(form.get('openings') ?? '1'),
          requirements: String(form.get('requirements') ?? '') || undefined,
          closesAt: String(form.get('closesAt') ?? '') || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível criar.');
      event.currentTarget.reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/rh/uploads', { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError('Não foi possível carregar o CV: ' + (data?.detail ?? data?.error ?? response.status));
      return;
    }
    const input = document.getElementById('jc-cv-url') as HTMLInputElement | null;
    if (input) input.value = data.path;
    event.target.value = '';
  }

    async function createCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/rh/recruitment/candidates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobOpeningId: openingId,
          firstName: String(form.get('firstName') ?? ''),
          lastName: String(form.get('lastName') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? '') || undefined,
          cvUrl: String(form.get('cvUrl') ?? '') || undefined,
          notes: String(form.get('notes') ?? '') || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível registar.');
      event.currentTarget.reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function moveCandidate(id: string, status: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/rh/recruitment/candidates/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Transição não permitida.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function admit(id: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/rh/recruitment/candidates/${id}/admit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível admitir.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function closeOpening(id: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/rh/recruitment/openings/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ENCERRADA' }),
      });
      if (!response.ok) throw new Error('Não foi possível encerrar.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const visibleCandidates = candidateStatus === 'ALL' ? candidates : candidates.filter((c) => c.status === candidateStatus);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Recrutamento e Seleção</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Recrutamento</h1>
        <p className="mt-1 text-sm text-[#607286]">Vagas → candidaturas → triagem → entrevista → avaliação → admissão.</p>
      </div>

      <FormError>{error}</FormError>

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={createOpening} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <h2 className="text-sm font-bold text-[#1c2d3f]">Nova vaga</h2>
          <FormSection title="Dados da vaga">
            <div className="sm:col-span-2">
              <FormField label="Título" name="jo-title" required><input id="jo-title" name="title" className="app-input" required /></FormField>
            </div>
            <div>
              <FormField label="Departamento" name="jo-dept">
                <select id="jo-dept" name="departmentId" className="app-input">
                  <option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </FormField>
            </div>
            <div>
              <FormField label="Cargo" name="jo-pos">
                <select id="jo-pos" name="positionId" className="app-input">
                  <option value="">—</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </FormField>
            </div>
            <div>
              <FormField label="Nº de vagas" name="jo-openings"><input id="jo-openings" name="openings" type="number" min={1} defaultValue={1} className="app-input" /></FormField>
            </div>
            <div>
              <FormField label="Fecha a" name="jo-close"><input id="jo-close" name="closesAt" type="date" className="app-input" /></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Requisitos" name="jo-req"><textarea id="jo-req" name="requirements" className="app-input min-h-20" /></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormActions saving={busy} onCancel={() => {}} saveLabel={busy ? 'A criar…' : 'Criar vaga'} />
            </div>
          </FormSection>
        </form>

        <form onSubmit={createCandidate} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
          <h2 className="text-sm font-bold text-[#1c2d3f]">Registar candidato</h2>
          <FormSection title="Dados do candidato">
            <div className="sm:col-span-2">
              <FormField label="Vaga" name="jc-opening" required>
                <select id="jc-opening" value={openingId} onChange={(e) => setOpeningId(e.target.value)} className="app-input" required>
                  {openings.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.candidateCount})</option>)}
                </select>
              </FormField>
            </div>
            <div>
              <FormField label="Nome" name="jc-fn" required><input id="jc-fn" name="firstName" className="app-input" required /></FormField>
            </div>
            <div>
              <FormField label="Apelido" name="jc-ln" required><input id="jc-ln" name="lastName" className="app-input" required /></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Email" name="jc-email" required><input id="jc-email" name="email" type="email" className="app-input" required /></FormField>
            </div>
            <div>
              <FormField label="Telefone" name="jc-phone"><input id="jc-phone" name="phone" className="app-input" /></FormField>
            </div>
            <div>
              <FormField label="CV" name="jc-cv-file" hint="PDF, PNG ou JPEG · até 10 MB">
                <input id="jc-cv-file" type="file" accept="application/pdf,image/png,image/jpeg" className="app-input" onChange={handleCvUpload} />
                <input id="jc-cv-url" name="cvUrl" className="app-input mt-2" placeholder="Ou cole um URL…" />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Notas" name="jc-notes"><input id="jc-notes" name="notes" className="app-input" /></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormActions saving={busy} disabled={openings.length === 0} onCancel={() => {}} saveLabel={busy ? 'A registar…' : 'Registar'} />
            </div>
          </FormSection>
        </form>
      </div>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f6] px-4 py-3">
          <h2 className="text-sm font-bold text-[#1c2d3f]">Vagas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]"><thead><tr><th>Vaga</th><th>Departamento/Cargo</th><th>Vagas</th><th>Candidatos</th><th>Estado</th><th>Acções</th></tr></thead>
            <tbody>{openings.map((opening) => (
              <tr key={opening.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{opening.title}</td>
                <td className="text-xs">{[opening.departmentName, opening.positionTitle].filter(Boolean).join(' · ') || '—'}</td>
                <td className="tabular-nums">{opening.openings}</td>
                <td className="tabular-nums">{opening.candidateCount}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${opening.status === 'ABERTA' ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#f0f3f7] text-[#52667a]'}`}>{STATUS_LABEL[opening.status]}</span></td>
                <td data-mobile-actions>{opening.status === 'ABERTA' && <button type="button" onClick={() => closeOpening(opening.id)} disabled={busy} className="min-h-9 rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#52667a]">Encerrar</button>}</td>
              </tr>
            ))}{openings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#708195]">Sem vagas.</td></tr>}</tbody></table>
        </div>
      </section>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f6] px-4 py-3">
          <h2 className="text-sm font-bold text-[#1c2d3f]">Candidatos</h2>
          <select aria-label="Filtrar estado" value={candidateStatus} onChange={(e) => setCandidateStatus(e.target.value)} className="app-input max-w-[220px]">
            <option value="ALL">Todos os estados</option>
            {['RECEBIDA', 'TRIAGEM', 'ENTREVISTA', 'AVALIACAO', 'APROVADO', 'REJEITADO', 'ADMITIDO'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]"><thead><tr><th>Nome</th><th>Email</th><th>Vaga</th><th>Estado</th><th>Acções</th></tr></thead>
            <tbody>{visibleCandidates.map((candidate) => (
              <tr key={candidate.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{candidate.firstName} {candidate.lastName}</td>
                <td className="text-xs">{candidate.email}</td>
                <td className="text-xs">{candidate.openingTitle}</td>
                <td><span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#37379e]">{STATUS_LABEL[candidate.status]}</span></td>
                <td data-mobile-actions>
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Avançar estado" value={""} onChange={(e) => { if (e.target.value) moveCandidate(candidate.id, e.target.value); }} className="app-input max-w-[140px]">
                      <option value="">Mover…</option>
                      {['RECEBIDA', 'TRIAGEM', 'ENTREVISTA', 'AVALIACAO', 'APROVADO', 'REJEITADO'].filter((s) => s !== candidate.status).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    {candidate.status === 'APROVADO' && <button type="button" onClick={() => admit(candidate.id)} disabled={busy} className="min-h-9 rounded-lg bg-[#021f87] px-3 text-xs font-semibold text-white">Admitir</button>}
                    {candidate.status === 'ADMITIDO' && <Link href={`/rh/funcionarios`} className="text-xs font-semibold text-[#021f87]">Ver funcionários →</Link>}
                  </div>
                </td>
              </tr>
            ))}{visibleCandidates.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#708195]">Sem candidatos.</td></tr>}</tbody></table>
        </div>
      </section>
    </div>
  );
}
