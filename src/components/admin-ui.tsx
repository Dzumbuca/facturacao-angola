export function AdminStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { ACTIVE: 'Activa', SUSPENDED: 'Suspensa', ISSUED: 'Emitida', CANCELLED: 'Anulada', SUCCESS: 'Sucesso', FAILURE: 'Falha' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'ACTIVE' || status === 'ISSUED' || status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{labels[status] ?? status}</span>;
}

export function AdminErrorState({ title }: { title: string }) {
  return <div><h1 className="text-3xl font-bold">{title}</h1><p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">Não foi possível carregar estes dados.</p></div>;
}
