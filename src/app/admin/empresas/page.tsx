import Link from 'next/link';
import { listAdminTenants } from '@/lib/admin-data';
import { AdminSearchFilters } from '@/components/admin-search-filters';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminStatusBadge, AdminErrorState } from '@/components/admin-ui';

type Params = Promise<Record<string, string | string[] | undefined>>;
export default async function AdminCompaniesPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  try {
    const result = await listAdminTenants(params);
    return <div><h1 className="text-3xl font-bold">Empresas</h1><p className="mt-2 text-slate-600">Estado e actividade operacional de cada empresa.</p><div className="mt-5"><AdminSearchFilters status={['ACTIVE', 'SUSPENDED']} values={params} /></div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th>Empresa</th><th>NIF</th><th>Utilizadores</th><th>Facturas</th><th>Estado</th><th>Criada</th><th></th></tr></thead><tbody>{result.items.map((v: any) => <tr key={v.id}><td className="font-semibold">{v.name}</td><td>{v.nif || '—'}</td><td>{v._count.users}</td><td>{v._count.invoices}</td><td><AdminStatusBadge status={v.status} /></td><td>{new Date(v.createdAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</td><td><Link href={`/admin/empresas/${v.id}`} className="font-semibold text-[#021f87]">Detalhes</Link></td></tr>)}</tbody></table></div>{!result.items.length && <p className="p-8 text-center text-slate-500">Nenhuma empresa encontrada.</p>}<AdminPagination page={result.page} pageCount={result.pageCount} searchParams={params} /></section>
    </div>;
  } catch { return <AdminErrorState title="Empresas" />; }
}
