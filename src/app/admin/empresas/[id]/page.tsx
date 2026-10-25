import { notFound } from 'next/navigation';
import { getAdminTenantDetail } from '@/lib/admin-data';
import { AdminStatusForm, AdminPlanForm } from '@/components/admin-status-form';
import { AdminStatusBadge } from '@/components/admin-ui';

export default async function AdminCompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let tenant;
  try { tenant = await getAdminTenantDetail(id); } catch { return <p role="alert">Não foi possível carregar a empresa.</p>; }
  if (!tenant) notFound();
  return <div><a href="/admin/empresas" className="text-sm font-semibold text-[#021f87]">← Empresas</a><h1 className="mt-3 text-3xl font-bold">{tenant.name}</h1><div className="mt-4 flex items-center gap-3"><AdminStatusBadge status={tenant.status} /><span className="text-sm text-slate-500">Criada {new Date(tenant.createdAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</span></div>
    <section className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"><Info label="NIF" value={tenant.nif} /><Info label="Email" value={tenant.email} /><Info label="Telefone" value={tenant.phone} /><Info label="Utilizadores" value={tenant._count.users} /><Info label="Facturas" value={tenant._count.invoices} /><Info label="Clientes" value={tenant._count.customers} /><Info label="Produtos" value={tenant._count.products} />{tenant.suspensionReason && <Info label="Motivo da suspensão" value={tenant.suspensionReason} />}</section>
    <h2 className="mb-3 mt-7 text-xl font-bold">Estado da empresa</h2><AdminStatusForm target="tenant" id={tenant.id} current={tenant.status} />
    <h2 className="mb-3 mt-7 text-xl font-bold">Plano comercial</h2><p className="mb-3 text-sm text-slate-600">Empresas no plano Grátis veem anúncios no painel; Pro não vê. Marca Pro quando confirmares o pagamento.</p><p className="mb-2 text-sm text-slate-600">Validade actual: {tenant.planExpiry ? new Date(tenant.planExpiry).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' }) : 'Sem prazo (Grátis ou legado)'}</p><AdminPlanForm id={tenant.id} current={tenant.plan} />
  </div>;
}
function Info({ label, value }: { label: string; value: unknown }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words">{value == null || value === '' ? '—' : String(value)}</dd></div>; }
