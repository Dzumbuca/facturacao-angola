import Link from 'next/link';
import { listAdminUsers } from '@/lib/admin-data';
import { AdminSearchFilters } from '@/components/admin-search-filters';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminStatusBadge, AdminErrorState } from '@/components/admin-ui';

type Params = Promise<Record<string, string | string[] | undefined>>;
const roleLabel: Record<string, string> = { USER: 'Utilizador', COMPANY_ADMIN: 'Administrador da empresa', BILLING: 'Facturação', VIEWER: 'Consulta' };
const platformRoleLabel: Record<string, string> = { NONE: '—', ADMIN: 'Superadministrador (legado)', SUPERADMIN: 'Superadministrador', COMPANY_MANAGER: 'Gestor de empresas', USER_MANAGER: 'Gestor de utilizadores', DOCUMENT_MANAGER: 'Gestor documental', AUDITOR: 'Auditor', SUPPORT: 'Suporte' };
export default async function AdminUsersPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  try {
    const result = await listAdminUsers(params);
    return <div><h1 className="text-3xl font-bold">Utilizadores</h1><p className="mt-2 text-slate-600">Contas e papéis da plataforma e das empresas.</p><div className="mt-5"><AdminSearchFilters status={['ACTIVE', 'SUSPENDED']} roles={['USER', 'COMPANY_ADMIN', 'BILLING', 'VIEWER']} values={params} /></div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Utilizador</th><th>Empresa</th><th>Papel na empresa</th><th>Plataforma</th><th>Estado</th><th>Criado</th><th></th></tr></thead><tbody>{result.items.map((v: any) => <tr key={v.id}><td><span className="font-semibold">{v.name || '—'}</span><br/><span className="text-xs text-slate-500">{v.email || 'Sem email'}</span></td><td>{v.tenant?.name || 'Sem empresa'}</td><td>{roleLabel[v.tenantRole] ?? v.tenantRole}</td><td>{platformRoleLabel[v.platformRole] || v.platformRole}</td><td><AdminStatusBadge status={v.status} /></td><td>{new Date(v.createdAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</td><td><Link href={`/admin/utilizadores/${v.id}`} className="font-semibold text-[#021f87]">Detalhes</Link></td></tr>)}</tbody></table></div>{!result.items.length && <p className="p-8 text-center text-slate-500">Nenhum utilizador encontrado.</p>}<AdminPagination page={result.page} pageCount={result.pageCount} searchParams={params} /></section>
    </div>;
  } catch { return <AdminErrorState title="Utilizadores" />; }
}
