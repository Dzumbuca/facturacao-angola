// Backfill idempotente para a Machine Platform (Fase 1).
// Regista apenas o catalogo da aplicacao "Machine Facturas" (core).
// Nao cria planos comerciais, nao altera subscrições/pagamentos/datas de validade,
// e nao activa aplicações indiscriminadamente: a activacao so ocorre para tenants
// que ja possuem acesso implicito a Machine Facturas (core => acesso preservado).
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

  // Transaccao idempotente: apenas regista o catalogo; nao altera direitos existentes.
  // TenantApplication nao e criado aqui — isApplicationEnabled trata core apps como
  // activas por defeito, preservando o acesso actual sem escrita indiscriminada.
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  return { app: app.slug, tenants: tenants.length, plansCreated: 0 };
}
