import { prisma } from './prisma';

/** Verifica se existe subscrição activa, válida e que inclui o módulo. */
async function subscriptionGrantsApp(tenantId: string, slug: string): Promise<boolean> {
  const app = await prisma.platformApplication.findUnique({ where: { slug } });
  if (!app) return false;
  const subs = await prisma.tenantSubscription.findMany({
    where: { tenantId, status: 'ACTIVE' },
    include: { plan: { include: { planApplications: true } } },
  });
  for (const sub of subs) {
    const notExpired = !sub.endsAt || sub.endsAt.getTime() > Date.now();
    if (!notExpired) continue;
    if (sub.plan.planApplications.some((pa: any) => pa.applicationId === app.id)) return true;
  }
  return false;
}

export async function isApplicationEnabled(tenantId: string, slug: string): Promise<boolean> {
  const app = await prisma.platformApplication.findUnique({ where: { slug } });
  if (!app || app.status !== 'ACTIVE') return false;
  // Aplicacoes core (ex.: Machine Facturas) preservam o acesso existente
  // mesmo antes de existir registo TenantApplication.
  if (app.isCore) {
    const ta = await prisma.tenantApplication.findUnique({
      where: { tenantId_applicationId: { tenantId, applicationId: app.id } },
    });
    if (!ta) return true;
    return !!ta.enabled;
  }
  // Módulos pagos: exige (a) módulo registado/activo para o tenant e (b) subscrição válida que inclui o app.
  const ta = await prisma.tenantApplication.findUnique({
    where: { tenantId_applicationId: { tenantId, applicationId: app.id } },
  });
  if (!ta?.enabled) return false;
  return subscriptionGrantsApp(tenantId, slug);
}

export async function listTenantApplications(tenantId: string) {
  const apps = await prisma.platformApplication.findMany({ orderBy: { name: 'asc' } });
  const enabled = await prisma.tenantApplication.findMany({ where: { tenantId } });
  const map = new Map(enabled.map((e: any) => [e.applicationId, e]));
  return apps.map((a: any) => ({
    slug: a.slug,
    name: a.name,
    description: a.description,
    icon: a.icon,
    status: a.status,
    isCore: a.isCore,
    enabled: a.isCore ? (map.has(a.id) ? !!(map.get(a.id) as any)?.enabled : true) : !!(map.get(a.id) as any)?.enabled,
  }));
}


/** Mapeamento do slug do módulo para o módulo do Machine (usado em gates). */
export const MACHINE_APPLICATION_MAP: Record<string, string> = {
  rh: 'machine-rh',
  stock: 'wms',
  'machine-rh': 'machine-rh',
  wms: 'wms',
  'machine-facturas': 'machine-facturas',
};
