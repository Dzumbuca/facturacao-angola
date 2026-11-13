'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError, CalendarField } from '@/components/rh/form-kit';
import { RhModuleHero } from '@/components/rh/premium-kit';
type Enrollment = { id: string; status: string; score: number | null; employee: { firstName: string; lastName: string; employeeNumber: string; position: { title: string } | null } };
type Course = { id: string; title: string; trainerName: string | null; startDate: string; endDate: string | null; cargaHoras: number; location: string | null; status: string; enrollments: Enrollment[] };
type Employee = { id: string; firstName: string; lastName: string; employeeNumber: string };

const STATUS: Record<string, string> = { AGENDADO: 'Agendado', EM_CURSO: 'Em curso', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
const ENROLL: Record<string, string> = { INSCRITO: 'Inscrito', CONCLUIDA: 'Concluída', DESISTENTE: 'Desistente' };

export function TrainingManager({ courses, employees, positions }: { courses: Course[]; employees: Employee[]; positions: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [startIso, setStartIso] = useState('');
  const [endIso, setEndIso] = useState('');
  const [enrollCourseId, setEnrollCourseId] = useState(courses[0]?.id ?? '');
  const [enrollEmployeeId, setEnrollEmployeeId] = useState(employees[0]?.id ?? '');

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('create'); setError('');
    try {
      const response = await fetch('/api/rh/training/courses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(form.get('title') ?? ''),
          trainerName: String(form.get('trainerName') ?? '') || undefined,
          startDate: String(form.get('startDate') ?? ''),
          endDate: String(form.get('endDate') ?? '') || undefined,
          cargaHoras: Number(form.get('cargaHoras') ?? '8'),
          location: String(form.get('location') ?? '') || undefined,
          requiredForPositionId: String(form.get('requiredForPositionId') ?? '') || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível criar o curso.');
      event.currentTarget.reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function setCourseStatus(id: string, status: string) {
    setBusy(id); setError('');
    try {
      const response = await fetch('/api/rh/training/courses', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) throw new Error('Não foi possível actualizar.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('enroll'); setError('');
    try {
      const response = await fetch('/api/rh/training/enrollments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: enrollCourseId, employeeId: enrollEmployeeId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível inscrever.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function finish(id: string, status: 'CONCLUIDA' | 'DESISTENTE', score: string) {
    setBusy(id); setError('');
    try {
      const response = await fetch(`/api/rh/training/enrollments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(score ? { score: Number(score) } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível concluir.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-5">
      <RhModuleHero
        eyebrow="Desenvolvimento humano"
        title="Formação profissional"
        description="Cursos, inscrições, participação e conclusão. Informação certa para auditorias e desenvolvimento de competências."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
      />

      <FormError>{error}</FormError>

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={createCourse} className="rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--text)]">Novo curso</h2>
          <FormSection title="Detalhes do curso">
            <div className="sm:col-span-2">
              <FormField label="Título" name="tc-title" required><input id="tc-title" name="title" className="app-input" required placeholder="Ex.: Segurança no trabalho" /></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Formador" name="tc-trainer"><input id="tc-trainer" name="trainerName" className="app-input" placeholder="Nome ou entidade" /></FormField>
            </div>
            <div>
              <FormField label="Início" name="tc-start" required><CalendarField id="tc-start" name="startDate" value={startIso} onChange={setStartIso} required /></FormField>
            </div>
            <div>
              <FormField label="Fim" name="tc-end"><CalendarField id="tc-end" name="endDate" value={endIso} onChange={setEndIso} /></FormField>
            </div>
            <div>
              <FormField label="Horas" name="tc-hours"><input id="tc-hours" name="cargaHoras" type="number" min={1} defaultValue={8} className="app-input" /></FormField>
            </div>
            <div>
              <FormField label="Local" name="tc-location"><input id="tc-location" name="location" className="app-input" placeholder="Presencial / online" /></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Exigido para cargo" name="tc-req">
                <select id="tc-req" name="requiredForPositionId" className="app-input">
                  <option value="">—</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormActions saving={busy === 'create'} onCancel={() => {}} saveLabel={busy === 'create' ? 'A criar…' : 'Criar curso'} />
            </div>
          </FormSection>
        </form>

        <form onSubmit={enroll} className="rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--text)]">Inscrever funcionário</h2>
          <FormSection title="Inscrição">
            <div className="sm:col-span-2">
              <FormField label="Curso" name="te-course" required>
                <select id="te-course" value={enrollCourseId} onChange={(e) => setEnrollCourseId(e.target.value)} className="app-input" required>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.enrollments.length})</option>)}
                </select>
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Funcionário" name="te-employee" required>
                <select id="te-employee" value={enrollEmployeeId} onChange={(e) => setEnrollEmployeeId(e.target.value)} className="app-input" required>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNumber})</option>)}
                </select>
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormActions saving={busy === 'enroll'} disabled={courses.length === 0 || employees.length === 0} onCancel={() => {}} saveLabel={busy === 'enroll' ? 'A inscrever…' : 'Inscrever'} />
            </div>
          </FormSection>
        </form>
      </div>

      {courses.map((course) => (
        <section key={course.id} className="rounded-xl border border-[var(--line)] bg-white">
          <div className="flex flex-col justify-between gap-2 border-b border-[#eef2f6] px-4 py-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-[var(--text)]">{course.title}</h2>
              <p className="text-xs text-[var(--text-muted)]">{new Date(course.startDate).toLocaleDateString('pt-AO')} · {course.cargaHoras}h · {course.trainerName ?? 'Formador a definir'}{course.location ? ` · ${course.location}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#37379e]">{STATUS[course.status] ?? course.status}</span>
              <select aria-label="Estado do curso" value={course.status} onChange={(e) => setCourseStatus(course.id, e.target.value)} className="app-input max-w-[150px]">
                {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead><tr><th>Funcionário</th><th>Cargo</th><th>Estado</th><th>Pontuação</th><th>Acções</th></tr></thead>
              <tbody>
                {course.enrollments.map((enrollment) => (
                  <EnrollmentRow key={enrollment.id} enrollment={enrollment} onFinish={finish} busy={busy} />
                ))}
                {course.enrollments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Sem inscrições.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {courses.length === 0 && <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sem cursos. Crie o primeiro acima.</p>}
    </div>
  );
}

function EnrollmentRow({ enrollment, onFinish, busy }: { enrollment: Enrollment; onFinish: (id: string, status: 'CONCLUIDA' | 'DESISTENTE', score: string) => void; busy: string }) {
  const [score, setScore] = useState(enrollment.score?.toString() ?? '');
  return (
    <tr>
      <td data-mobile-primary className="font-semibold text-[var(--text)]">{enrollment.employee.firstName} {enrollment.employee.lastName} <span className="text-xs text-[var(--text-muted)]">{enrollment.employee.employeeNumber}</span></td>
      <td className="text-xs">{enrollment.employee.position?.title ?? '—'}</td>
      <td><span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#37379e]">{ENROLL[enrollment.status] ?? enrollment.status}</span></td>
      <td><input aria-label="Pontuação" type="number" min={0} max={100} placeholder="0–100" value={score} onChange={(e) => setScore(e.target.value)} className="app-input max-w-[90px] !min-h-8 !py-1 text-xs" /></td>
      <td data-mobile-actions>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => onFinish(enrollment.id, 'CONCLUIDA', score)} disabled={busy === enrollment.id} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256] disabled:opacity-50">Concluir</button>
          <button type="button" onClick={() => onFinish(enrollment.id, 'DESISTENTE', '')} disabled={busy === enrollment.id} className="min-h-9 rounded-lg border border-[#f0d3d3] px-3 text-xs font-semibold text-[#a83939] disabled:opacity-50">Desistir</button>
        </div>
      </td>
    </tr>
  );
}