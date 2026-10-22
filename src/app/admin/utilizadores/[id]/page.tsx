import { notFound } from 'next/navigation';
import { getAdminUserDetail } from '@/lib/admin-data';
import { AdminRoleForm, AdminStatusForm } from '@/components/admin-status-form';
import { AdminStatusBadge } from '@/components/admin-ui';

export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user;
  try { user = await getAdminUserDetail(id); } catch { return <p role="alert">Não foi possível carregar o utilizador.</p>; }
  if (!user) notFound();
  const platformRoleLabel: Record<string, string> = { NONE: 'Nenhum', ADMIN: 'Superadministrador (legado)', SUPERADMIN: 'Superadministrador', COMPANY_MANAGER: 'Gestor de empresas', USER_MANAGER: 'Gestor de utilizadores', DOCUMENT_MANAGER: 'Gestor documental', AUDITOR: 'Auditor', SUPPORT: 'Suporte' };
  return <div><a href="/admin/utilizadores" className="text-sm font-semibold text-[#021f87]">← Utilizadores</a><h1 className="mt-3 text-3xl font-bold">{user.name || 'Utilizador sem nome'}</h1><p className="mt-1 text-slate-600">{user.email || 'Sem email'}</p><div className="mt-4 flex items-center gap-3"><AdminStatusBadge status={user.status}/><span className="text-sm">Papel de plataforma: {platformRoleLabel[user.platformRole] || user.platformRole}</span></div>
    <section className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"><Info label="Empresa" value={user.tenant?.name} /><Info label="Papel na empresa" value={user.tenantRole} /><Info label="Criado" value={new Date(user.createdAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })} /><Info label="Motivo da suspensão" value={user.suspensionReason} /></section>
    <h2 className="mb-3 mt-7 text-xl font-bold">Estado da conta</h2><AdminStatusForm target="user" id={user.id} current={user.status}/>
    <h2 className="mb-3 mt-7 text-xl font-bold">Papel na empresa</h2><AdminRoleForm target="tenant" id={user.id} current={user.tenantRole}/>
    <h2 className="mb-3 mt-7 text-xl font-bold">Papel da plataforma</h2><p className="mb-3 text-sm text-slate-600">Esta alteração é separada dos papéis internos da empresa. Não pode alterar o próprio papel global.</p><AdminRoleForm target="platform" id={user.id} current={user.platformRole}/>
  </div>;
}
function Info({ label, value }: { label: string; value: unknown }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words">{value == null || value === '' ? '—' : String(value)}</dd></div>; }
