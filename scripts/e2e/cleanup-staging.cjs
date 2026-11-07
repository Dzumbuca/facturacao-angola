// scripts/e2e/cleanup-staging.cjs
// Limpa exclusivamente os dados do tenant de testes E2E.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEST_TENANT_ID = 'e2e00000-0000-0000-0000-000000000001';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('staging') && !dbUrl.includes('127.0.0.1:5436')) {
    throw new Error('ABORT: DATABASE_URL nao parece ser staging.');
  }

  // Delete in dependency order, scoped to test tenant
  await prisma.stockMovement.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.stockReservation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.stockTransferItem.deleteMany({ where: { transfer: { tenantId: TEST_TENANT_ID } } });
  await prisma.stockTransfer.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.stockAdjustmentItem.deleteMany({ where: { adjustment: { tenantId: TEST_TENANT_ID } } });
  await prisma.stockAdjustment.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.stockLot.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.productWarehouseStock.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.product.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.warehouse.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

  console.log('Cleanup E2E concluido para tenant', TEST_TENANT_ID);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });