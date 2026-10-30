// Backfill idempotente para a Machine Platform (Fase 1).
// Regista a aplicacao "Machine Facturas" e activa-a para todos os tenants existentes.
// Nao altera planos, subscrições nem direitos de acesso.
import { prisma } from './prisma';

export async function backfillMachinePlatform() {
  const app = await prisma.platformApplication.upsert({
    where: { slug: 'machine-facturas' },
    update: {},
    create: {
      slug: 'machine-facturas',
      name: 'Machine Facturas',
      description: 'Facturacao e gestao empresarial para Angola',
      icon: '/logo.png',
      isCore: true,
      status: 'ACTIVE',
    },
  });

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const t of tenants) {
    await prisma.tenantApplication.upsert({
      where: { tenantId_applicationId: { tenantId: t.id, applicationId: app.id } },
      update: { enabled: true, enabledAt: new Date() },
      create: { tenantId: t.id, applicationId: app.id, enabled: true, enabledAt: new Date() },
    });
  }

  // Plano starter apenas se nao existir; nao sobrescreve subscrições existentes.
  const plan = await prisma.subscriptionPlan.upsert({
    where: { slug: 'starter' },
    update: {},
    create: {
      slug: 'starter',
      name: 'Starter',
      description: 'Plano inicial com Machine Facturas',
      priceKz: 0,
      isBundle: false,
    },
  });

  await prisma.planApplication.upsert({
    where: { planId_applicationId: { planId: plan.id, applicationId: app.id } },
    update: {},
    create: { planId: plan.id, applicationId: app.id },
  });

  return { app: app.slug, tenants: tenants.length, plan: plan.slug };
}
