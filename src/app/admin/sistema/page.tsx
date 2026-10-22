import { getAdminSystemStatus } from '@/lib/admin-data';
import { AdminStatusBadge } from '@/components/admin-ui';
export default async function AdminSystemPage() {
  const system = await getAdminSystemStatus();
  return <div><h1 className="text-3xl font-bold">Sistema</h1><p className="mt-2 text-slate-600">Verificações técnicas disponíveis nesta instalação.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">
    <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Base de dados</h2><p className="mt-3"><AdminStatusBadge status={system.database === 'available' ? 'ACTIVE' : 'SUSPENDED'}/></p><p className="mt-2 text-sm text-slate-500">Verificação por consulta simples ao PostgreSQL.</p></article>
    <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Processo actual</h2><p className="mt-3 text-sm">Uptime: {Math.floor(system.uptimeSeconds / 3600)} h {Math.floor((system.uptimeSeconds % 3600) / 60)} min</p><p className="mt-2 text-sm text-slate-500">Refere-se apenas ao processo que serviu esta página.</p>{system.version && <p className="mt-2 text-sm">Versão: {system.version}</p>}</article>
    <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Monitorização de erros</h2><p className="mt-3 text-sm text-slate-600">Ainda não existe fonte configurada de telemetria de erros.</p></article>
    <article className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Armazenamento e integrações externas</h2><p className="mt-3 text-sm text-slate-600">Não existe verificação configurada para serviços externos ou armazenamento separado.</p></article>
  </div></div>;
}
