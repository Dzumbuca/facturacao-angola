import { prisma } from './prisma';

// Regista a aplicacao "Machine Stock" no catalogo da plataforma.
// Nao activa para nenhum tenant automaticamente — activacao manual/contratacao.
export async function registerMachineStock() {
  return prisma.platformApplication.upsert({
    where: { slug: 'machine-stock' },
    update: {},
    create: {
      slug: 'machine-stock',
      name: 'Machine Stock',
      description: 'Gestao de stock e armazem',
      isCore: false,
      status: 'COMING_SOON',
    },
  });
}
