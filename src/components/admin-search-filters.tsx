export function AdminSearchFilters({ status = [], roles = [], values = {}, roleTitle = 'Papel na empresa' }: { status?: string[]; roles?: string[]; values?: Record<string, string | string[] | undefined>; roleTitle?: string }) {
  const labels: Record<string, string> = { ACTIVE: 'Activo', SUSPENDED: 'Suspenso', ISSUED: 'Emitido', CANCELLED: 'Anulado', SUCCESS: 'Sucesso', FAILURE: 'Falha', USER: 'Utilizador', COMPANY_ADMIN: 'Administrador da empresa', BILLING: 'Facturação', VIEWER: 'Consulta', ADMIN: 'Superadministrador', SUPERADMIN: 'Superadministrador', COMPANY_MANAGER: 'Gestor de empresas', USER_MANAGER: 'Gestor de utilizadores', DOCUMENT_MANAGER: 'Gestor documental', AUDITOR: 'Auditor', SUPPORT: 'Suporte' };
  const current = (key: string) => typeof values[key] === 'string' ? values[key] as string : '';
  return <form method="get" className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(180px,1fr)_180px_180px_auto]">
    <label><span className="app-label">Pesquisar</span><input className="app-input" name="search" defaultValue={current('search')} maxLength={100} /></label>
    {status.length > 0 ? <label><span className="app-label">Estado</span><select className="app-input" name="status" defaultValue={current('status')}><option value="">Todos</option>{status.map((v) => <option key={v} value={v}>{labels[v] ?? v}</option>)}</select></label> : <span />}
    {roles.length > 0 ? <label><span className="app-label">{roleTitle}</span><select className="app-input" name="role" defaultValue={current('role')}><option value="">Todos</option>{roles.map((v) => <option key={v} value={v}>{labels[v] ?? v}</option>)}</select></label> : <span />}
    <button className="self-end rounded-lg bg-[#021f87] px-5 py-3 font-semibold text-white hover:bg-blue-900">Filtrar</button>
  </form>;
}
