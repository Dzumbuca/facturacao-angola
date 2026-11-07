// tests/e2e/wms/wms-operations.test.ts
// E2E HTTP real (NextAuth + Prisma + APIs) contra a BD descartável.
// Requer: servidor Next em APP_URL (default http://localhost:3002) e seed aplicado.
import { describe, it, expect } from 'vitest';
import { login, authenticatedFetch } from './http-auth-harness';

const TENANT_A_PRODUCT = 'e2e00000-0000-0000-0000-ppppppppppp1';
const TENANT_B_PRODUCT = 'e2e00000-0000-0000-0000-ppppppppppp3';
const TENANT_A_WAREHOUSE = 'e2e00000-0000-0000-0000-aaaaaaaaaaaa';
const USER_B = 'e2e-other@machinefacturas.test';

describe('WMS v2 E2E - Devoluções', () => {
  it('GET /api/stock/returns exige sessão (401)', async () => {
    const res = await fetch(`${process.env.APP_URL || 'http://localhost:3002'}/api/stock/returns`);
    expect(res.status).toBe(401);
  });

  it('regista devolução física e lista em GET /api/stock/returns', async () => {
    const session = await login();
    const reference = `E2E-RET-${Date.now()}`;

    const create = await authenticatedFetch('/api/stock/returns', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: TENANT_A_PRODUCT,
        warehouseId: TENANT_A_WAREHOUSE,
        quantity: 1,
        reason: 'E2E devolução física',
        reference,
      }),
    });
    expect(create.status).toBe(201);

    const list = await authenticatedFetch(`/api/stock/returns?reference=${encodeURIComponent(reference)}`, session);
    expect(list.status).toBe(200);
    const data = await list.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0].idempotencyKey).toMatch(/^return-/);
    expect(data.items[0].product?.name).toContain('E2E Produto A1');
    expect(data.total).toBeGreaterThanOrEqual(1);
  });
});

describe('WMS v2 E2E - Movimentos paginados', () => {
  it('GET /api/stock/movements devolve shape paginado com limit aplicado', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/movements?page=1&limit=2', session);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeLessThanOrEqual(2);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(2);
    expect(typeof data.total).toBe('number');
    expect(data.totalPages).toBeGreaterThanOrEqual(1);
  });
});

describe('WMS v2 E2E - Isolamento entre tenants', () => {
  it('utilizador do tenant B apenas vê produtos do tenant B', async () => {
    const sessionB = await login(USER_B);
    const res = await authenticatedFetch('/api/stock/products', sessionB);
    expect(res.status).toBe(200);
    const products = await res.json();
    const ids = products.map((p: any) => p.id);
    expect(ids).toContain(TENANT_B_PRODUCT);
    expect(ids).not.toContain(TENANT_A_PRODUCT);
  });

  it('utilizador do tenant B não consegue movimentar produto do tenant A', async () => {
    const sessionB = await login(USER_B);
    const res = await authenticatedFetch('/api/stock/movements', sessionB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: TENANT_A_PRODUCT,
        warehouseId: TENANT_A_WAREHOUSE,
        type: 'IN',
        quantity: 1,
        reason: 'E2E cross-tenant proibido',
      }),
    });
    expect(res.status).toBe(404);
  });

  it('movimentos do tenant B não referenciam produtos do tenant A', async () => {
    const sessionB = await login(USER_B);
    const res = await authenticatedFetch('/api/stock/movements?limit=50', sessionB);
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const item of data.items) {
      expect(item.productId).not.toBe(TENANT_A_PRODUCT);
    }
  });
});
