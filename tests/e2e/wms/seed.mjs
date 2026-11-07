// Seed sintético e idempotente para E2E do WMS v2 numa base de dados descartável.
// Uso: DATABASE_URL=postgresql://... node tests/e2e/wms/seed.mjs
// NUNCA apontar para staging/produção: a BD alvo deve ser exclusivamente descartável.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const FIXTURES = {
  tenantA: 'e2e00000-0000-0000-0000-000000000001',
  tenantB: 'e2e00000-0000-0000-0000-000000000002',
  userAEmail: 'e2e-test@machinefacturas.test',
  userBEmail: 'e2e-other@machinefacturas.test',
  password: 'TestPass123!',
  warehouseA: 'e2e00000-0000-0000-0000-aaaaaaaaaaaa',
  warehouseA2: 'e2e00000-0000-0000-0000-cccccccccccc',
  warehouseB: 'e2e00000-0000-0000-0000-bbbbbbbbbbbb',
  supplierA: 'e2e00000-0000-0000-0000-ssssssssssss',
  supplierB: 'e2e00000-0000-0000-0000-sssssssssss2',
  productA1: 'e2e00000-0000-0000-0000-ppppppppppp1',
  productA2: 'e2e00000-0000-0000-0000-ppppppppppp2',
  productB1: 'e2e00000-0000-0000-0000-ppppppppppp3',
  lotA1: 'e2e00000-0000-0000-0000-llllllllllll',
};

async function main() {
  const { tenantA, tenantB, userAEmail, userBEmail, password, warehouseA, warehouseA2, warehouseB, supplierA, supplierB, productA1, productA2, productB1, lotA1 } = FIXTURES;

  const passwordHash = await bcrypt.hash(password, 10);

  const tenants = [
    [tenantA, 'E2E Armazém A', '500000001'],
    [tenantB, 'E2E Armazém B', '500000002'],
  ];
  for (const [id, name, nif] of tenants) {
    await prisma.tenant.upsert({
      where: { id },
      update: { name, nif, plan: 'PRO', status: 'ACTIVE' },
      create: { id, name, nif, plan: 'PRO', status: 'ACTIVE' },
    });
  }

  // Módulo WMS activo para os dois tenants (o gate bloqueia por omissão).
  const wmsApp = await prisma.platformApplication.upsert({
    where: { slug: 'wms' },
    update: { name: 'Armazém e Stock', status: 'ACTIVE' },
    create: { slug: 'wms', name: 'Armazém e Stock', description: 'Gestão de armazém e stock', icon: '📦', version: '1.0.0', status: 'ACTIVE', isCore: false },
  });
  for (const [id] of tenants) {
    await prisma.tenantApplication.upsert({
      where: { tenantId_applicationId: { tenantId: id, applicationId: wmsApp.id } },
      update: { enabled: true, enabledAt: new Date(), disabledAt: null },
      create: { tenantId: id, applicationId: wmsApp.id, enabled: true, enabledAt: new Date() },
    });
  }

  // Pacotes comerciais (preços de lançamento; SKUs sem limite definido).
  const plans = [
    { slug: 'gratis', name: 'Grátis', priceKz: 0, priceYearly: null, limits: { max_warehouses: 0, max_products: 30, max_clients: 30, max_invoices_per_month: 15 }, transfers: false },
    { slug: 'basico', name: 'Básico', priceKz: 5000, priceYearly: 51000, limits: { max_warehouses: 1, max_products: 100, max_clients: 100, max_invoices_per_month: 100 }, transfers: false },
    { slug: 'profissional', name: 'Profissional', priceKz: 12500, priceYearly: 127500, limits: { max_warehouses: 3, max_products: 500, max_clients: 500 }, transfers: true },
    { slug: 'empresarial', name: 'Empresarial', priceKz: 25000, priceYearly: 255000, limits: { max_warehouses: 10 }, transfers: true },
  ];
  for (const planSeed of plans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: { slug: planSeed.slug },
      update: { name: planSeed.name, priceKz: planSeed.priceKz, priceYearly: planSeed.priceYearly, isActive: true },
      create: { slug: planSeed.slug, name: planSeed.name, description: planSeed.name, priceKz: planSeed.priceKz, priceYearly: planSeed.priceYearly, billingCycle: 'MONTHLY', isActive: true },
    });
    for (const [metric, value] of Object.entries(planSeed.limits)) {
      await prisma.planLimit.upsert({
        where: { planId_metric: { planId: plan.id, metric } },
        update: { value },
        create: { planId: plan.id, metric, value },
      });
    }
    await prisma.planCapability.upsert({
      where: { planId_capability: { planId: plan.id, capability: 'transfers' } },
      update: { enabled: planSeed.transfers },
      create: { planId: plan.id, capability: 'transfers', enabled: planSeed.transfers },
    });
  }

  const upsertUser = async (email, tenantId) => prisma.user.upsert({
    where: { email },
    update: {
      tenantId, password: passwordHash, status: 'ACTIVE',
      emailVerified: new Date(), emailVerificationRequired: false,
      tenantRole: 'COMPANY_ADMIN', sessionVersion: 0,
    },
    create: {
      email, name: email.split('@')[0], tenantId, password: passwordHash, status: 'ACTIVE',
      emailVerified: new Date(), emailVerificationRequired: false,
      tenantRole: 'COMPANY_ADMIN',
    },
  });

  await upsertUser(userAEmail, tenantA);
  await upsertUser(userBEmail, tenantB);

  await prisma.warehouse.upsert({
    where: { id: warehouseA },
    update: { tenantId: tenantA, name: 'Armazém E2E A', isDefault: true, isActive: true },
    create: { id: warehouseA, tenantId: tenantA, name: 'Armazém E2E A', location: 'Luanda', isDefault: true, isActive: true },
  });
  await prisma.warehouse.upsert({
    where: { id: warehouseA2 },
    update: { tenantId: tenantA, name: 'Armazém E2E A2', isDefault: false, isActive: true },
    create: { id: warehouseA2, tenantId: tenantA, name: 'Armazém E2E A2', location: 'Huambo', isDefault: false, isActive: true },
  });
  await prisma.warehouse.upsert({
    where: { id: warehouseB },
    update: { tenantId: tenantB, name: 'Armazém E2E B', isDefault: true, isActive: true },
    create: { id: warehouseB, tenantId: tenantB, name: 'Armazém E2E B', location: 'Benguela', isDefault: true, isActive: true },
  });

  await prisma.supplier.upsert({
    where: { id: supplierA },
    update: { tenantId: tenantA, name: 'Fornecedor E2E A', nif: '700000001', isActive: true },
    create: { id: supplierA, tenantId: tenantA, name: 'Fornecedor E2E A', nif: '700000001', isActive: true },
  });
  await prisma.supplier.upsert({
    where: { id: supplierB },
    update: { tenantId: tenantB, name: 'Fornecedor E2E B', nif: '700000002', isActive: true },
    create: { id: supplierB, tenantId: tenantB, name: 'Fornecedor E2E B', nif: '700000002', isActive: true },
  });

  // Produtos: stock base consistente com ProductWarehouseStock.
  const products = [
    { id: productA1, tenantId: tenantA, name: 'E2E Produto A1', codigo: 'E2E-A1', price: 100, stock: 10, warehouseId: warehouseA },
    { id: productA2, tenantId: tenantA, name: 'E2E Produto A2', codigo: 'E2E-A2', price: 50, stock: 3, warehouseId: warehouseA },
    { id: productB1, tenantId: tenantB, name: 'E2E Produto B1', codigo: 'E2E-B1', price: 75, stock: 5, warehouseId: warehouseB },
  ];
  for (const p of products) {
    // Limpar dependências que referenciam ProductWarehouseStock antes do reset
    // (reservas e itens de ajuste), para o seed poder ser reexecutado.
    await prisma.stockReservation.deleteMany({ where: { tenantId: p.tenantId, productId: p.id } });
    await prisma.stockAdjustmentItem.deleteMany({ where: { productId: p.id } });
    await prisma.productWarehouseStock.deleteMany({ where: { productId: p.id } });
    await prisma.product.upsert({
      where: { id: p.id },
      update: { tenantId: p.tenantId, name: p.name, codigo: p.codigo, price: p.price, stock: p.stock },
      create: { id: p.id, tenantId: p.tenantId, name: p.name, codigo: p.codigo, price: p.price, stock: p.stock, minStock: 2, categoria: 'GERAL' },
    });
    await prisma.productWarehouseStock.create({
      data: { tenantId: p.tenantId, productId: p.id, warehouseId: p.warehouseId, lotId: null, quantity: p.stock },
    });
  }

  // Lote base para o produto A1 (data de validade futura).
  await prisma.stockLot.upsert({
    where: { id: lotA1 },
    update: { tenantId: tenantA, productId: productA1, lotNumber: 'LOTE-E2E-1', expiryDate: new Date('2027-12-31') },
    create: { id: lotA1, tenantId: tenantA, productId: productA1, lotNumber: 'LOTE-E2E-1', expiryDate: new Date('2027-12-31') },
  });

  console.log(JSON.stringify({
    seeded: true,
    tenants: [tenantA, tenantB],
    users: [userAEmail, userBEmail],
    products: [productA1, productA2, productB1],
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
