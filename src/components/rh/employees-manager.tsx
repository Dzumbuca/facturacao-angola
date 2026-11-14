'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { SignedImage } from '@/components/rh/signed-image';
import { FormSection, FormActions, FormError, CurrencyInput, CalendarField } from '@/components/rh/form-kit';
import { FormSplit, FormSidebar, FormHero } from '@/components/rh/premium-kit';
import { DataTable } from '@/components/ui/data-table';

type Department = { id: string; name: string };
type Position = { id: string; title: string; departmentId: string | null };
type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  bi: string | null;
  nif: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  birthDate: string | null;
  gender: string | null;
  photoUrl: string | null;
  departmentId: string | null;
  positionId: string | null;
  shiftId: string | null;
  hireDate: string;
  contractType: string;
  baseSalary: number;
  status: string;
  hasPin?: boolean;
  bankName: string | null;
  bankAccount: string | null;
  bankIban: string | null;
  department: Department | null;
  position: { id: string; title: string } | null;
  shift: { id: string; name: string; startTime: string; endTime: string } | null;
};

const WATCHED_KEYS = ['firstName','lastName','bi','nif','email','phone','departmentId','positionId','shiftId','contractType','status'] as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVO: 'Activo', SUSPENSO: 'Suspenso', FERIAS: 'Férias', CESSAO: 'Cessão', INACTIVO: 'Inactivo',
};
const CONTRACT_LABEL: Record<string, string> = {
  INDEFINIDO: 'Tempo indeterminado', TERMO_CERTO: 'Termo certo', ESTAGIO: 'Estágio', PRESTACAO_SERVICOS: 'Prestação de serviços',
};

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(value || 0);
}
function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString('pt-AO') : '—';
}

export function EmployeesManager({ initialEmployees, departments, positions, shifts }: {
  initialEmployees: Employee[];
  departments: Department[];
  positions: Position[];
  shifts: { id: string; name: string; startTime: string; endTime: string }[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [hireDateIso, setHireDateIso] = useState('');
  const [birthDateIso, setBirthDateIso] = useState('');
  const [baseSalaryValue, setBaseSalaryValue] = useState<number | null>(null);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const effective = useMemo(() => {
    const base: Record<string, string> = {};
    WATCHED_KEYS.forEach((k) => { base[k] = formValues[k] ?? String((editing as any)?.[k] ?? ''); });
    base['departmentId'] = formValues['departmentId'] ?? String(editing?.departmentId ?? '');
    base['positionId'] = formValues['positionId'] ?? String(editing?.positionId ?? '');
    return base;
  }, [formValues, editing]);
  const progress = useMemo(() => {
    const weights: Record<string, number> = { firstName: 10, lastName: 10, bi: 10, nif: 10, email: 10, phone: 10, departmentId: 10, positionId: 10, shiftId: 10, contractType: 10, status: 10 };
    let score = 0;
    Object.entries(weights).forEach(([k, w]) => { if (String(effective[k] ?? '').trim()) score += w; });
    if (baseSalaryValue != null) score += 0; // already weighted above
    return Math.min(100, score);
  }, [effective, baseSalaryValue]);
  const resolvedDepartment = departments.find((d) => d.id === effective['departmentId'])?.name ?? '';
  const resolvedPosition = positions.find((pos) => pos.id === effective['positionId'])?.title ?? '';
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ svg: string; name: string; expiresAt: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (statusFilter && employee.status !== statusFilter) return false;
      if (!term) return true;
      return [employee.firstName, employee.lastName, employee.employeeNumber, employee.bi, employee.email]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [employees, query, statusFilter]);

  function openCreate() { setEditing(null); setError(''); setQr(null); setHireDateIso(''); setBirthDateIso(''); setBaseSalaryValue(null); setOpen(true); }
  function openEdit(employee: Employee) { setEditing(employee); setError(''); setQr(null); setHireDateIso(employee.hireDate?.slice(0,10) ?? ''); setBirthDateIso(employee.birthDate?.slice(0,10) ?? ''); setBaseSalaryValue(employee.baseSalary ?? null); setOpen(true); }

  async function loadQr() {
    if (!editing) return;
    setQrLoading(true); setError('');
    try {
      const response = await fetch(`/api/rh/employees/${editing.id}/qr`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível gerar o QR.');
      setQr({ svg: data.svg, name: data.employee?.name ?? 'Funcionário', expiresAt: data.expiresAt });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQrLoading(false);
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/rh/uploads', { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert('Não foi possível carregar a fotografia: ' + (data?.detail ?? data?.error ?? response.status));
      return;
    }
    const input = document.getElementById('rh-photo-url') as HTMLInputElement | null;
    if (input) input.value = data.path;
    event.target.value = '';
  }

    async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      bi: String(form.get('bi') ?? ''),
      nif: String(form.get('nif') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      address: String(form.get('address') ?? ''),
      birthDate: String(form.get('birthDate') ?? '') || null,
      gender: String(form.get('gender') ?? ''),
      photoUrl: String(form.get('photoUrl') ?? ''),
      departmentId: String(form.get('departmentId') ?? '') || null,
      positionId: String(form.get('positionId') ?? '') || null,
      shiftId: String(form.get('shiftId') ?? '') || null,
      hireDate: String(form.get('hireDate') ?? ''),
      contractType: String(form.get('contractType') ?? 'INDEFINIDO'),
      baseSalary: String(form.get('baseSalary') ?? ''),
      status: String(form.get('status') ?? 'ACTIVO'),
      pin: String(form.get('pin') ?? ''),
      bankName: String(form.get('bankName') ?? ''),
      bankAccount: String(form.get('bankAccount') ?? ''),
      bankIban: String(form.get('bankIban') ?? ''),
    };
    if (!String(payload.pin ?? '')) delete payload.pin;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(editing ? `/api/rh/employees/${editing.id}` : '/api/rh/employees', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      const normalized: Employee = {
        ...data,
        baseSalary: Number(data.baseSalary),
        department: departments.find((d) => d.id === data.departmentId) ?? null,
        position: positions.find((p) => p.id === data.positionId) ? { id: data.positionId, title: positions.find((p) => p.id === data.positionId)!.title } : null,
      };
      setEmployees((current) => editing
        ? current.map((item) => item.id === normalized.id ? normalized : item)
        : [...current, normalized]);
      if (!editing && data.generatedPin) {
        setGeneratedPin(String(data.generatedPin));
      } else {
        setOpen(false);
        setEditing(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Pessoas</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Funcionários</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastro, organização e dados profissionais da equipa.</p>
        </div>
        <button type="button" onClick={openCreate} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white hover:bg-[#061965]">Novo funcionário</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por nome, nº, BI ou email"
          className="app-input sm:max-w-sm"
          aria-label="Pesquisar funcionários"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="app-input sm:max-w-44" aria-label="Filtrar por estado">
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <DataTable>
        <thead><tr><th className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--text-muted)]">Funcionário</th><th className="border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--text-muted)]">Nº</th><th className="border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--text-muted)]">Cargo / Departamento</th><th className="border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--text-muted)]">Admissão</th><th className="border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--text-muted)]">Salário</th><th className="border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--text-muted)]">Estado</th><th className="border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--text-muted)]">Acções</th></tr></thead>
          <tbody>
            {filtered.map((employee) => (
              <tr key={employee.id}>
                <td data-mobile-primary>
                  <div className="flex items-center gap-2">
                    <SignedImage path={employee.photoUrl} alt={`${employee.firstName} ${employee.lastName}`} className="h-9 w-9 rounded-full border border-[var(--line)] object-cover" fallback={<div className="grid h-9 w-9 place-items-center rounded-full bg-[#eef2ff] text-xs font-bold text-[var(--blue)]">{employee.firstName.charAt(0).toUpperCase()}{employee.lastName.charAt(0).toUpperCase()}</div>} />
                    <Link href={`/rh/funcionarios/${employee.id}`} className="block font-semibold text-[var(--text)] underline-offset-2 hover:underline">{employee.firstName} {employee.lastName}
                      <span className="block text-xs text-[var(--text-muted)]">{employee.email || '—'}</span>
                    </Link>
                  </div>
                </td>
                <td className="font-mono text-xs text-[var(--text-muted)]">{employee.employeeNumber}</td>
                <td>
                  <span className="block text-sm">{employee.position?.title ?? '—'}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{employee.department?.name ?? '—'}</span>
                </td>
                <td className="tabular-nums">{date(employee.hireDate)}</td>
                <td className="tabular-nums">{money(employee.baseSalary)}</td>
                <td><span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--blue)]">{STATUS_LABEL[employee.status] ?? employee.status}</span></td>
                <td data-mobile-actions><button type="button" onClick={() => openEdit(employee)} className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold text-[var(--blue)]">Editar</button></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-[#7094aa]">Nenhum funcionário encontrado para a pesquisa</td></tr>
            )}
          </tbody>
      </DataTable>

      {generatedPin && (
        <div role="dialog" aria-modal="true" aria-labelledby="rh-pin-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
          <div className="form-card-light w-full max-w-md rounded-t-2xl border-[#e6eaf0] p-6 shadow-2xl sm:rounded-2xl">
            <h2 id="rh-pin-title" className="text-lg font-bold text-[var(--text)]">Funcionário criado</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">O PIN do ponto gerado automaticamente é mostrado uma única vez. Anota-o agora e entrega ao funcionário.</p>
            <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-4 text-center">
              <span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8a99ab]">PIN do ponto</span>
              <p className="mt-1 text-3xl font-bold tracking-[.3em] text-[var(--blue)]">{generatedPin}</p>
            </div>
            <button type="button" onClick={() => { setGeneratedPin(null); setOpen(false); setEditing(null); }} className="mt-4 min-h-11 w-full rounded-lg bg-[#021f87] text-sm font-semibold text-white">Fechar</button>
          </div>
        </div>
      )}
      {open && !generatedPin && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#102b46]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="rh-employee-title" className="form-card-light max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-[#e6eaf0] p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-7">
            <div className="mb-4 flex items-start justify-between gap-4">
              <FormHero eyebrow="Machine RH" title={editing ? 'Editar funcionário' : 'Novo funcionário'} description="Os dados ficam neste formulário até ao envio. A barra lateral mostra o que já está preenchido." icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20a6 6 0 0 1 12 0"/></svg>} />
              <button type="button" aria-label="Fechar" disabled={saving} onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-lg text-xl text-[var(--text-muted)] hover:bg-[#f0f4f8]">×</button>
            </div>
            <form className="space-y-4" onSubmit={submit} key={editing?.id ?? 'novo'} noValidate
              onInput={(e) => {
                const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
                if (!target.name) return;
                setFormValues((prev) => ({ ...prev, [target.name]: target.value }));
              }}>
              <FormSplit main={<>
              <FormSection title="Identificação pessoal">

                  <div><label htmlFor="rh-first" className="app-label">Nome *</label><input id="rh-first" name="firstName" className="ds-input" required defaultValue={editing?.firstName ?? ''} /></div>
                  <div><label htmlFor="rh-last" className="app-label">Apelido *</label><input id="rh-last" name="lastName" className="ds-input" required defaultValue={editing?.lastName ?? ''} /></div>
                  <div><label htmlFor="rh-bi" className="app-label">BI</label><input id="rh-bi" name="bi" className="ds-input" defaultValue={editing?.bi ?? ''} /></div>
                  <div><label htmlFor="rh-nif" className="app-label">NIF</label><input id="rh-nif" name="nif" className="ds-input" defaultValue={editing?.nif ?? ''} /></div>
                  <div><CalendarField id="rh-birth" name="birthDate" value={birthDateIso} onChange={setBirthDateIso} /></div>
                  <div><label htmlFor="rh-gender" className="app-label">Género</label><select id="rh-gender" name="gender" className="ds-input" defaultValue={editing?.gender ?? ''}><option value="">Não indicado</option><option value="M">Masculino</option><option value="F">Feminino</option><option value="OUTRO">Outro</option></select></div>
              </FormSection>

              <FormSection title="Contactos">

                  <div><label htmlFor="rh-email" className="app-label">Email</label><input id="rh-email" name="email" type="email" className="ds-input" defaultValue={editing?.email ?? ''} /></div>
                  <div><label htmlFor="rh-phone" className="app-label">Telefone</label><input id="rh-phone" name="phone" className="ds-input" defaultValue={editing?.phone ?? ''} /></div>
                  <div className="sm:col-span-2"><label htmlFor="rh-address" className="app-label">Morada</label><input id="rh-address" name="address" className="ds-input" defaultValue={editing?.address ?? ''} /></div>
                  <div className="sm:col-span-2">
  <label htmlFor="rh-photo-file" className="app-label">Fotografia (ficheiro)</label>
  <input id="rh-photo-file" type="file" accept="image/png,image/jpeg,image/webp" className="ds-input" onChange={handlePhotoUpload} />
  <input id="rh-photo-url" name="photoUrl" className="app-input mt-2" placeholder="Ou cole um URL…" defaultValue={editing?.photoUrl ?? ''} />
  {(photoPreview || editing?.photoUrl) && (
    <div className="mt-2 flex items-center gap-3">
      {photoPreview
        ? <img src={photoPreview} alt="Pré-visualização da fotografia" className="h-16 w-16 rounded-full border border-[var(--line)] object-cover" />
        : <SignedImage path={editing?.photoUrl} alt={editing ? `${editing.firstName} ${editing.lastName}` : 'Fotografia do funcionário'} className="h-16 w-16 rounded-full border border-[var(--line)] object-cover" fallback={<div className="grid h-16 w-16 place-items-center rounded-full bg-[#eef2ff] text-lg font-bold text-[var(--blue)]">{editing?.firstName.charAt(0).toUpperCase()}{editing?.lastName.charAt(0).toUpperCase()}</div>} />}
      <span className="text-xs text-[var(--text-muted)]">Pré-visualização da fotografia</span>
    </div>
  )}
</div>
              </FormSection>

              <FormSection title="Informação profissional">

                  <div><label htmlFor="rh-dept" className="app-label">Departamento</label><select id="rh-dept" name="departmentId" className="ds-input" defaultValue={editing?.departmentId ?? ''}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label htmlFor="rh-pos" className="app-label">Cargo</label><select id="rh-pos" name="positionId" className="ds-input" defaultValue={editing?.positionId ?? ''}><option value="">—</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
                  <div><label htmlFor="rh-shift" className="app-label">Horário</label><select id="rh-shift" name="shiftId" className="ds-input" defaultValue={editing?.shiftId ?? ''}><option value="">—</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime}–{shift.endTime})</option>)}</select></div>
                  <div><CalendarField id="rh-hire" name="hireDate" value={hireDateIso} onChange={setHireDateIso} required /></div>
                  <div><label htmlFor="rh-contract" className="app-label">Tipo de contrato</label><select id="rh-contract" name="contractType" className="ds-input" defaultValue={editing?.contractType ?? 'INDEFINIDO'}>{Object.entries(CONTRACT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div><label htmlFor="rh-salary" className="app-label">Salário-base (Kz) *</label><CurrencyInput id="rh-salary" name="baseSalary" value={baseSalaryValue} onChange={setBaseSalaryValue} required /></div>
                  <div><label htmlFor="rh-status" className="app-label">Estado</label><select id="rh-status" name="status" className="ds-input" defaultValue={editing?.status ?? 'ACTIVO'}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div><label htmlFor="rh-pin" className="app-label">PIN do ponto <span className="font-normal text-[var(--text-muted)]">{editing?.hasPin ? '(definido)' : '(gerar automático)'}</span></label><input id="rh-pin" name="pin" type="password" inputMode="numeric" maxLength={8} className="app-input tracking-[.3em]" placeholder={editing?.hasPin ? 'Deixar vazio para manter' : 'Deixar vazio = gera automaticamente'} /></div>
              </FormSection>

              {editing && (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#4a5d70]">QR do ponto (expira em 5 min)</p>
                    <button type="button" onClick={loadQr} disabled={qrLoading} className="min-h-9 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--blue)] disabled:opacity-50">{qrLoading ? 'A gerar…' : 'Gerar QR'}</button>
                  </div>
                  {qr && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-28 w-28 shrink-0 rounded bg-white p-1 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
                      <div className="text-xs text-[var(--text-muted)]">
                        <p className="font-semibold text-[var(--text)]">{qr.name}</p>
                        <p className="mt-1">Expira às {new Date(qr.expiresAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}.</p>
                        <p className="mt-1">Use no quiosque em /rh/ponto.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              </>}
              sidebar={<FormSidebar title="Resumo do funcionário" progress={progress} lines={[
                { label: 'Nome', value: `${effective.firstName} ${effective.lastName}`.trim() || undefined },
                { label: 'BI', value: effective.bi || undefined },
                { label: 'NIF', value: effective.nif || undefined },
                { label: 'Departamento', value: resolvedDepartment || undefined },
                { label: 'Cargo', value: resolvedPosition || undefined },
                { label: 'Contrato', value: effective.contractType === 'INDEFINIDO' ? 'Tempo indeterminado' : effective.contractType ? 'A prazo (termo/estágio/prestação)' : undefined },
                { label: 'Estado', value: effective.status || undefined },
              ]} footer={<p className="text-[11px] leading-5 text-[#8094a9]">A percentagem mostra campos obrigatórios preenchidos. Nenhum dado é enviado sem submeter o formulário.</p>} />} />
              <FormSection title="Dados bancários (restrito)" description="Acesso restrito a perfis com escrita de funcionários.">
                <div><label htmlFor="rh-bank" className="app-label">Banco</label><input id="rh-bank" name="bankName" className="ds-input" defaultValue={editing?.bankName ?? ''} /></div>
                <div><label htmlFor="rh-account" className="app-label">Conta</label><input id="rh-account" name="bankAccount" className="ds-input" defaultValue={editing?.bankAccount ?? ''} /></div>
                <div><label htmlFor="rh-iban" className="app-label">IBAN</label><input id="rh-iban" name="bankIban" className="ds-input" defaultValue={editing?.bankIban ?? ''} /></div>
              </FormSection>

              <FormError>{error}</FormError>
              <FormActions saving={saving} onCancel={() => setOpen(false)} saveLabel={editing ? 'Guardar alterações' : 'Criar funcionário'} />
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
