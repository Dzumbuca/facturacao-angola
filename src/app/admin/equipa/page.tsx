import Link from 'next/link';
import { listAdminPlatformTeam } from '@/lib/admin-data';
import { AdminSearchFilters } from '@/components/admin-search-filters';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminStatusBadge, AdminErrorState } from '@/components/admin-ui';
import { prisma } from '@/lib/prisma';
import { getPlatformMember } from '@/lib/admin-auth';
import { InviteConsole } from './invite-console';

type Params = Promise<Record<string, string | string[] | undefined>>;
const roleLabel: Record<string, string> = { ADMIN: 'Superadministrador', SUPERADMIN: 'Superadministrador', COMPANY_MANAGER: 'Gestor de empresas', USER_MANAGER: 'Gestor de utilizadores', DOCUMENT_MANAGER: 'Gestor documental', AUDITOR: 'Auditor', SUPPORT: 'Suporte' };
export default async function AdminTeamPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  try {
    const [result, operator, pendingInvites] = await Promise.all([
      listAdminPlatformTeam(params), getPlatformMember(), (prisma as any).platformTeamInvite.findMany({ where: { status: 'PENDING', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, name: true, email: true, platformRole: true, expiresAt: true } }),
    ]);
    return <div>
      <h1 className="text-3xl font-bold">Equipa de gestão</h1>
      <p className="mt-2 text-slate-600">Membros com acesso global à plataforma. Os utilizadores das empresas aparecem na secção própria.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Membros activos" value={result.active}/><Metric label="Contas suspensas" value={result.suspended}/><Metric label="Convites pendentes" value={pendingInvites.length}/></div>
      <div className="mt-5"><AdminSearchFilters status={['ACTIVE', 'SUSPENDED']} roles={Object.keys(roleLabel)} roleTitle="Categoria da plataforma" values={params}/></div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th>Membro</th><th>Categoria</th><th>Estado</th><th>Criado</th><th>Acções</th></tr></thead><tbody>{result.items.map((member: any) => <tr key={member.id}><td><strong>{member.name || '—'}</strong><br/><span className="text-xs text-slate-500">{member.email || 'Sem email'}</span></td><td>{roleLabel[member.platformRole] || member.platformRole}</td><td><AdminStatusBadge status={member.status}/></td><td>{new Date(member.createdAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</td><td><Link href={`/admin/utilizadores/${member.id}`} className="font-semibold text-[#021f87]">Gerir membro</Link></td></tr>)}</tbody></table></div>{!result.items.length && <p className="p-8 text-center text-slate-500">Ainda não há membros nesta pesquisa.</p>}<AdminPagination page={result.page} pageCount={result.pageCount} searchParams={params}/></section>
      {operator.permissions.includes('team.invite') && <InviteConsole invites={pendingInvites.map((invite: any) => ({ ...invite, expiresAt: invite.expiresAt.toISOString() }))} canSuper={operator.platformRole === 'ADMIN' || operator.platformRole === 'SUPERADMIN'}/>}
    </div>;
  } catch { return <AdminErrorState title="Equipa de gestão"/>; }
}
function Metric({ label, value }: { label: string; value: string | number }) { return <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></article>; }

