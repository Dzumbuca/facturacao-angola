// tests/e2e/wms/stock-entries.test.ts
// ETAPA 2 - Entradas de Stock (staging, APIs reais)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'e2e00000-0000-0000-0000-000000000001';
const TEST_PRODUCT_1 = 'e2e00000-0000-0000-0000-ppppppppppp1';
const TEST_WAREHOUSE_A = 'e2e00000-0000-0000-0000-aaaaaaaaaaaa';
const TEST_SUPPLIER = 'e2e00000-0000-0000-0000-ssssssssssss';

describe('WMS v2 E2E - Stock Entries (staging)', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('creates a purchase order via real API', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/purchase/orders', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: TEST_SUPPLIER,
        warehouseId: TEST_WAREHOUSE_A,
        items: [{ productId: TEST_PRODUCT_1, quantity: 5, unitPrice: 10 }],
      }),
    });
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(order.id).toBeTruthy();
    expect(['PENDING', 'PENDENTE']).toContain(order.status);
  });

  it('lists purchase orders for the test tenant', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/purchase/orders', session);
    expect(res.status).toBe(200);
    const orders = await res.json();
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
  });
});
