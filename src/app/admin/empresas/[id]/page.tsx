import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminTenantDetail } from '@/lib/admin-data';
import { listTenantApplications } from '@/lib/platform-apps';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { AdminStatusForm, AdminPlanForm, AdminWmsForm, AdminCommercialPlanForm, AdminModuleForm, AdminRenewForm } from '@/components/admin-status-form';
import { AdminStatusBadge } from '@/components/admin-ui';

export default async function AdminCompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let tenant;
  try { tenant = await getAdminTenantDetail(id); } catch { return <p role="alert">Não foi possível carregar a empresa.</p>; }
  if (!tenant) notFound();
  const apps = await listTenantApplications(tenant.id);
  const currentRh = apps.find((a: any) => a.slug === 'rh');
  const currentWms = apps.find((a: any) => a.slug === 'wms');
  const rhEnabled = !!currentRh?.enabled;
  const wmsModuleEnabled = !!currentWms?.enabled;
  const planSlug = (tenant as any).commercialPlanSlug ?? 'free';
  const wmsEnabled = await isApplicationEnabled(tenant.id, 'wms');
  return <div><Link href="/admin/empresas" className="text-sm font-semibold text-[#021f87]">← Empresas</Link><h1 className="mt-3 text-3xl font-bold">{tenant.name}</h1><div className="mt-4 flex items-center gap-3"><AdminStatusBadge status={tenant.status} /><span className="text-sm text-slate-500">Criada {new Date(tenant.createdAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</span></div>
    <section className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"><Info label="NIF" value={tenant.nif} /><Info label="Email" value={tenant.email} /><Info label="Telefone" value={tenant.phone} /><Info label="Utilizadores" value={tenant._count.users} /><Info label="Facturas" value={tenant._count.invoices} /><Info label="Clientes" value={tenant._count.customers} /><Info label="Produtos" value={tenant._count.products} />{tenant.suspensionReason && <Info label="Motivo da suspensão" value={tenant.suspensionReason} />}</section>
    <h2 className="mb-3 mt-7 text-xl font-bold">Estado da empresa</h2><AdminStatusForm target="tenant" id={tenant.id} current={tenant.status} />
    <h2 className="mb-3 mt-7 text-xl font-bold">Plano comercial</h2><p className="mb-3 text-sm text-slate-600">Empresas no plano Grátis veem anúncios no painel; Pro não vê. Marca Pro quando confirmares o pagamento.</p><p className="mb-2 text-sm text-slate-600">Validade actual: {tenant.planExpiry ? new Date(tenant.planExpiry).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' }) : 'Sem prazo (Grátis ou legado)'}</p><AdminPlanForm id={tenant.id} current={tenant.plan} />
    <h2 className="mb-3 mt-7 text-xl font-bold">Módulo Armazém e Stock</h2><p className="mb-3 text-sm text-slate-600">Activa ou desactiva o acesso ao módulo de armazém e stock. Os dados do cliente são sempre preservados; desactivar bloqueia apenas o acesso.</p><AdminWmsForm id={tenant.id} current={wmsEnabled} />
    <h2 className="mb-3 mt-7 text-xl font-bold">Plano Machine (comercial)</h2>
    <p className="mb-3 text-sm text-slate-600">FREE = facturação grátis para sempre; Stock, RH e Business envolvem os módulos Armazém/Stock e Machine RH. O plano fica associado à empresa; é reversível e auditado.</p>
    <p className="mb-3 text-sm text-slate-600">Plano pago exige <strong>data de validade explícita</strong>. Ao expirar os módulos pagos são desactivados automaticamente; os dados do cliente ficam sempre guardados.</p>
    <AdminCommercialPlanForm id={tenant.id} current={planSlug} currentExpiry={tenant.commercialPlanExpiry} />
    <AdminRenewForm id={tenant.id} currentExpiry={tenant.commercialPlanExpiry} />
    <h2 className="mb-3 mt-7 text-xl font-bold">Armazém e Stock</h2>
    <p className="mb-3 text-sm text-slate-600">Dados preservados para sempre; desactivar bloqueia apenas o acesso.</p>
    <AdminModuleForm id={tenant.id} module="wms" current={wmsModuleEnabled} />
    <h2 className="mb-3 mt-7 text-xl font-bold">Machine RH</h2>
    <p className="mb-3 text-sm text-slate-600">Activamos este módulo apenas nos planos RH e Business; para além disso pode ser concedido como acesso experimental.</p>
    <AdminModuleForm id={tenant.id} module="rh" current={rhEnabled} />
  </div>;
}
function Info({ label, value }: { label: string; value: unknown }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words">{value == null || value === '' ? '—' : String(value)}</dd></div>; }
