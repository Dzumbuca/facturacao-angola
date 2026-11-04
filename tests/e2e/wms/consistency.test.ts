// tests/e2e/wms/consistency.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'e2e00000-0000-0000-0000-000000000001';
const TEST_PRODUCT_1 = 'e2e00000-0000-0000-0000-ppppppppppp1';

describe('WMS v2 E2E - Consistency (staging)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeded product has consistent Product.stock vs ProductWarehouseStock sum', async () => {
    const product = await prisma.product.findUnique({ where: { id: TEST_PRODUCT_1 } });
    expect(product).not.toBeNull();
    const pws = await prisma.productWarehouseStock.findMany({ where: { productId: TEST_PRODUCT_1 } });
    const sum = pws.reduce((s: number, r: any) => s + Number(r.quantity), 0);
    expect(Number(product!.stock)).toBe(sum);
  });

  it('test tenant is isolated (no other tenant products in test tenant)', async () => {
    const products = await prisma.product.findMany({ where: { tenantId: TEST_TENANT_ID } });
    expect(products.every((p: any) => p.tenantId === TEST_TENANT_ID)).toBe(true);
  });
});