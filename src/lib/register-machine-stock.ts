import { prisma } from './prisma';

// Regista a aplicacao "Machine Stock" no catalogo da plataforma.
// Activacao manual/contratacao por tenant via TenantApplication.
export async function registerMachineStock() {
  return prisma.platformApplication.upsert({
    where: { slug: 'machine-stock' },
    update: {
      name: 'Machine Stock',
      description: 'Gestao de stock e armazem',
    },
    create: {
      slug: 'machine-stock',
      name: 'Machine Stock',
      description: 'Gestao de stock e armazem',
      isCore: false,
      status: 'ACTIVE',
    },
  });
}
