import Link from 'next/link';
import { getAdminPlatformConfig, getAdminConfigHistory } from '@/lib/admin-data';
import { AdminConfigForm } from '@/components/admin-config-form';
import { AdminErrorState } from '@/components/admin-ui';
export default async function AdminSettingsPage() {
  let config; let history;
  try { [config, history] = await Promise.all([getAdminPlatformConfig(), getAdminConfigHistory()]); } catch { return <AdminErrorState title="Configurações"/>; }
  return <div><h1 className="text-3xl font-bold">Configurações</h1><p className="mt-2 text-slate-600">Identidade e contactos públicos da plataforma. Não inclui credenciais nem parâmetros fiscais.</p><AdminConfigForm config={config}/>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Gestão da equipa</h2><p className="mt-1 text-sm text-slate-600">Aceda à área separada dos membros com permissões globais.</p><Link href="/admin/equipa" className="mt-3 inline-flex rounded-lg bg-[#021f87] px-4 py-2.5 text-sm font-semibold text-white">Abrir equipa de gestão</Link></section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Histórico de alterações</h2>{history.length ? <ul className="mt-4 divide-y divide-slate-100">{history.map((item: any) => <li className="py-4" key={item.id}><p className="font-semibold">{item.actorUser?.name || item.actorUser?.email || 'Administrador'} · {new Date(item.createdAt).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })}</p><p className="mt-1 text-sm text-slate-600">Motivo: {item.reason || '—'}</p><pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(item.metadata, null, 2)}</pre></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Ainda não há alterações registadas.</p>}</section>
  </div>;
}
