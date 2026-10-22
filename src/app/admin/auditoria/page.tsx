import { listAdminAuditLogs } from '@/lib/admin-data';
import { AdminSearchFilters } from '@/components/admin-search-filters';
import { AdminPagination } from '@/components/admin-pagination';
import { AdminStatusBadge, AdminErrorState } from '@/components/admin-ui';
type Params = Promise<Record<string, string | string[] | undefined>>;
export default async function AdminAuditPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  try {
    const result = await listAdminAuditLogs(params);
    return <div><h1 className="text-3xl font-bold">Auditoria</h1><p className="mt-2 text-slate-600">Registo cronológico de alterações administrativas. Este histórico é apenas de leitura.</p><div className="mt-5"><AdminSearchFilters status={['SUCCESS', 'FAILURE']} values={params}/></div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th>Data</th><th>Operador</th><th>Acção</th><th>Recurso</th><th>Motivo</th><th>Resultado</th></tr></thead><tbody>{result.items.map((v: any) => <tr key={v.id}><td>{new Date(v.createdAt).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })}</td><td>{v.actorUser?.name || v.actorUser?.email || v.actorType}</td><td>{v.action}</td><td>{v.resourceType}{v.resourceId ? ` · ${v.resourceId}` : ''}</td><td className="max-w-xs whitespace-normal">{v.reason || '—'}</td><td><AdminStatusBadge status={v.result}/></td></tr>)}</tbody></table></div>{!result.items.length && <p className="p-8 text-center text-slate-500">Ainda não existem eventos de auditoria.</p>}<AdminPagination page={result.page} pageCount={result.pageCount} searchParams={params}/></section>
    </div>;
  } catch { return <AdminErrorState title="Auditoria"/>; }
}
