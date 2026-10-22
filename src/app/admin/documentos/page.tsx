import { listAdminInvoices } from '@/lib/admin-data';
import { AdminSearchFilters } from '@/components/admin-search-filters';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminStatusBadge, AdminErrorState } from '@/components/admin-ui';
type Params = Promise<Record<string, string | string[] | undefined>>;
export default async function AdminDocumentsPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  try {
    const result = await listAdminInvoices(params);
    return <div><h1 className="text-3xl font-bold">Documentos</h1><p className="mt-2 text-slate-600">Consulta global de facturas. Os dados fiscais não podem ser alterados nesta área.</p><div className="mt-5"><AdminSearchFilters status={['ISSUED', 'CANCELLED', 'DRAFT']} values={params}/></div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="data-table min-w-[850px]"><thead><tr><th>Número</th><th>Tipo</th><th>Empresa</th><th>Cliente</th><th>Emissão</th><th>Estado</th><th>Total</th></tr></thead><tbody>{result.items.map((v: any) => <tr key={v.id}><td className="font-semibold">{v.number}</td><td>{v.type}</td><td>{v.tenant.name}</td><td>{v.customer.name}</td><td>{new Date(v.issuedAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</td><td><AdminStatusBadge status={v.status}/></td><td>{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: v.currency }).format(Number(v.total))}</td></tr>)}</tbody></table></div>{!result.items.length && <p className="p-8 text-center text-slate-500">Nenhum documento encontrado.</p>}<AdminPagination page={result.page} pageCount={result.pageCount} searchParams={params}/></section>
    </div>;
  } catch { return <AdminErrorState title="Documentos"/>; }
}
