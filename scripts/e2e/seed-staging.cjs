// scripts/e2e/seed-staging.cjs
// Seed isolado para tenant de testes WMS v2 em staging.
// Uso: DATABASE_URL=... node scripts/e2e/seed-staging.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEST_TENANT_ID = 'e2e00000-0000-0000-0000-000000000001';
const TEST_WAREHOUSE_A = 'e2e00000-0000-0000-0000-aaaaaaaaaaaa';
const TEST_WAREHOUSE_B = 'e2e00000-0000-0000-0000-bbbbbbbbbbbb';
const TEST_PRODUCT_1 = 'e2e00000-0000-0000-0000-ppppppppppp1';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('staging') && !dbUrl.includes('127.0.0.1:5436')) {
    throw new Error('ABORT: DATABASE_URL nao parece ser staging. Refusing to seed.');
  }

  // Tenant
  await prisma.tenant.upsert({
    where: { id: TEST_TENANT_ID },
    update: {},
    create: { id: TEST_TENANT_ID, name: 'E2E Test Tenant' },
  });

  // Warehouses
  for (const w of [
    { id: TEST_WAREHOUSE_A, name: 'Armazem A (E2E)' },
    { id: TEST_WAREHOUSE_B, name: 'Armazem B (E2E)' },
  ]) {
    await prisma.warehouse.upsert({
      where: { id: w.id },
      update: {},
      create: { ...w, tenantId: TEST_TENANT_ID },
    });
  }

  // Test user (auth)
  const bcrypt = require('bcrypt');
  const passwordHash = bcrypt.hashSync('TestPass123!', 10);
  await prisma.user.upsert({
    where: { email: 'e2e-test@machinefacturas.test' },
    update: { password: passwordHash, tenantId: TEST_TENANT_ID, status: 'ACTIVE' },
    create: {
      id: 'e2e00000-0000-0000-0000-uuuuuuuuuuuu',
      email: 'e2e-test@machinefacturas.test',
      name: 'E2E Test User',
      password: passwordHash,
      tenantId: TEST_TENANT_ID,
      status: 'ACTIVE',
      emailVerificationRequired: false,
    },
  });

  // Test supplier
  await prisma.supplier.upsert({
    where: { id: 'e2e00000-0000-0000-0000-ssssssssssss' },
    update: {},
    create: {
      id: 'e2e00000-0000-0000-0000-ssssssssssss',
      tenantId: TEST_TENANT_ID,
      name: 'Fornecedor E2E',
    },
  });

  // Product
  await prisma.product.upsert({
    where: { id: TEST_PRODUCT_1 },
    update: { stock: 100 },
    create: {
      id: TEST_PRODUCT_1,
      tenantId: TEST_TENANT_ID,
      name: 'Produto E2E',
      codigo: 'PROD-E2E-001',
      price: 10,
      taxRate: 14,
      stock: 100,
      categoria: 'GERAL',
      minStock: 5,
    },
  });

  // Consistent PWS rows (50 per warehouse)
  for (const wh of [TEST_WAREHOUSE_A, TEST_WAREHOUSE_B]) {
    await prisma.productWarehouseStock.upsert({
      where: { id: 'e2e-pws-' + wh },
      update: { quantity: 50 },
      create: {
        id: 'e2e-pws-' + wh,
        tenantId: TEST_TENANT_ID,
        productId: TEST_PRODUCT_1,
        warehouseId: wh,
        quantity: 50,
        reservedQuantity: 0,
        minStock: 5,
      },
    });
  }

  console.log('Seed E2E concluido. Tenant:', TEST_TENANT_ID);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });