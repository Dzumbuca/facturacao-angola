import { prisma } from './prisma';

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
  const ta = await prisma.tenantApplication.findUnique({
    where: { tenantId_applicationId: { tenantId, applicationId: app.id } },
  });
  return !!ta?.enabled;
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

