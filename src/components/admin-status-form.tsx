'use client';
import { useActionState } from 'react';
import { setTenantStatus, setUserStatus, setTenantRole, setPlatformRole, setTenantPlan } from '@/lib/admin-actions';

type State = { ok: boolean; message: string };
const initial: State = { ok: false, message: '' };

function StatusForm({ action, id, title, options }: { action: (state: State, data: FormData) => Promise<State>; id: string; title: string; options: [string, string][] }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} onSubmit={(event) => { if (!window.confirm('Confirmas esta alteração administrativa? O motivo ficará registado na auditoria.')) event.preventDefault(); }} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
    <input type="hidden" name="id" value={id} />
    <label><span className="app-label">{title}</span><select className="app-input" name="value" required>{options.map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label>
    <label><span className="app-label">Motivo (obrigatório)</span><input className="app-input" name="reason" minLength={5} maxLength={500} required /></label>
    <button disabled={pending} className="self-end rounded-lg bg-[#021f87] px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? 'A guardar…' : 'Guardar'}</button>
    {state.message && <p role="status" className={state.ok ? 'text-sm text-emerald-700 sm:col-span-3' : 'text-sm text-red-700 sm:col-span-3'}>{state.message}</p>}
  </form>;
}

export function AdminStatusForm({ target, id, current }: { target: 'tenant' | 'user'; id: string; current: string }) {
  const action = async (_: State, data: FormData) => target === 'tenant'
    ? setTenantStatus(String(data.get('id')), data.get('value') as 'ACTIVE' | 'SUSPENDED', String(data.get('reason')))
    : setUserStatus(String(data.get('id')), data.get('value') as 'ACTIVE' | 'SUSPENDED', String(data.get('reason')));
  return <StatusForm key={`${target}-${current}`} action={action} id={id} title="Novo estado" options={[[current, `Manter: ${current === 'ACTIVE' ? 'Activo' : 'Suspenso'}`], ['ACTIVE', 'Activo'], ['SUSPENDED', 'Suspenso']]} />;
}

export function AdminRoleForm({ target, id, current }: { target: 'tenant' | 'platform'; id: string; current: string }) {
  const action = async (_: State, data: FormData) => target === 'tenant'
    ? setTenantRole(String(data.get('id')), data.get('value') as 'USER' | 'COMPANY_ADMIN' | 'BILLING' | 'VIEWER', String(data.get('reason')))
    : setPlatformRole(String(data.get('id')), data.get('value') as 'NONE' | 'ADMIN' | 'SUPERADMIN' | 'COMPANY_MANAGER' | 'USER_MANAGER' | 'DOCUMENT_MANAGER' | 'AUDITOR' | 'SUPPORT', String(data.get('reason')));
  const options = target === 'tenant' ? [['USER', 'Utilizador'], ['COMPANY_ADMIN', 'Administrador da empresa'], ['BILLING', 'Facturação'], ['VIEWER', 'Consulta']] : [['NONE', 'Sem papel global'], ['ADMIN', 'Superadministrador (papel legado)'], ['COMPANY_MANAGER', 'Gestor de empresas'], ['USER_MANAGER', 'Gestor de utilizadores'], ['DOCUMENT_MANAGER', 'Gestor documental'], ['AUDITOR', 'Auditor'], ['SUPPORT', 'Suporte'], ['SUPERADMIN', 'Superadministrador']];
  return <StatusForm key={`${target}-${current}`} action={action} id={id} title={target === 'tenant' ? 'Papel na empresa' : 'Papel na plataforma'} options={options as [string, string][]} />;
}

export function AdminPlanForm({ id, current }: { id: string; current: string }) {
  const action = async (_: State, data: FormData) => setTenantPlan(String(data.get('id')), data.get('value') as 'FREE' | 'PRO', String(data.get('reason')));
  const options: [string, string][] = [[current, `Manter: ${current === 'PRO' ? 'Pro (sem anúncios)' : 'Grátis (com anúncios)'}`], ['FREE', 'Grátis — vê anúncios'], ['PRO', 'Pro — sem anúncios']];
  return <StatusForm key={`plan-${current}`} action={action} id={id} title="Plano comercial" options={options} />;
}
