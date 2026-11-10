// tests/e2e/wms/wms-operations.test.ts
// E2E HTTP real (NextAuth + Prisma + APIs) contra a BD descartável.
// Requer: servidor Next em APP_URL (default http://localhost:3002) e seed aplicado.
import { describe, it, expect } from 'vitest';
import { login, authenticatedFetch } from './http-auth-harness';

const TENANT_A_PRODUCT = 'e2e00000-0000-0000-0000-ppppppppppp1';
const TENANT_B_PRODUCT = 'e2e00000-0000-0000-0000-ppppppppppp3';
const TENANT_A_WAREHOUSE = 'e2e00000-0000-0000-0000-aaaaaaaaaaaa';
const TENANT_A_WAREHOUSE_2 = 'e2e00000-0000-0000-0000-cccccccccccc';
const TENANT_B_WAREHOUSE = 'e2e00000-0000-0000-0000-bbbbbbbbbbbb';
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

describe('WMS v2 E2E - Armazém obrigatório nos movimentos', () => {
  async function balanceInWarehouse(session: Awaited<ReturnType<typeof login>>, warehouseId: string) {
    const res = await authenticatedFetch(`/api/stock/balances?productId=${TENANT_A_PRODUCT}&warehouseId=${warehouseId}`, session);
    expect(res.status).toBe(200);
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows.find((entry: any) => entry.lotId == null) : null;
    return Number(row?.quantity ?? 0);
  }

  it('rejeita movimento sem armazém', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/movements', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: TENANT_A_PRODUCT, type: 'IN', quantity: 1, reason: 'E2E sem armazém' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Armazém');
  });

  it('rejeita armazém pertencente a outra empresa', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/movements', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: TENANT_A_PRODUCT, warehouseId: TENANT_B_WAREHOUSE, type: 'IN', quantity: 1 }),
    });
    expect(res.status).toBe(404);
  });

  it('regista entrada, saída e ajuste com warehouseId e saldo por armazém', async () => {
    const session = await login();
    const before = await balanceInWarehouse(session, TENANT_A_WAREHOUSE_2);

    for (const [type, quantity] of [['IN', 5], ['OUT', 2], ['ADJUSTMENT', 1]] as const) {
      const res = await authenticatedFetch('/api/stock/movements', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: TENANT_A_PRODUCT, warehouseId: TENANT_A_WAREHOUSE_2, type, quantity, reason: `E2E ${type}` }),
      });
      expect(res.status, type).toBe(201);
      const movement = await res.json();
      expect(movement.warehouseId).toBe(TENANT_A_WAREHOUSE_2);
      expect(movement.type).toBe(type);
    }

    expect(await balanceInWarehouse(session, TENANT_A_WAREHOUSE_2)).toBe(before + 4);
  });

  it('rejeita saída superior ao stock do armazém selecionado', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/movements', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: TENANT_A_PRODUCT, warehouseId: TENANT_A_WAREHOUSE_2, type: 'OUT', quantity: 99999 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('WMS v2 E2E - Catálogo e pesquisa de produtos', () => {
  it('pesquisa por nome/SKU e devolve shape paginado', async () => {
    const session = await login();
    const bySku = await authenticatedFetch(`/api/produtos/search?sku=${encodeURIComponent('E2E-A1')}`, session);
    expect(bySku.status).toBe(200);
    const skuData = await bySku.json();
    expect(skuData.total).toBeGreaterThanOrEqual(1);
    expect(skuData.items.some((p: any) => p.id === TENANT_A_PRODUCT)).toBe(true);
    expect(typeof skuData.totalPages).toBe('number');

    const paged = await authenticatedFetch('/api/produtos/search?q=&limit=1&page=1', session);
    const pagedData = await paged.json();
    expect(pagedData.items.length).toBeLessThanOrEqual(1);
    expect(pagedData.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('pesquisa isolada por empresa (tenant B não vê produtos de A)', async () => {
    const sessionB = await login(USER_B);
    const res = await authenticatedFetch(`/api/produtos/search?q=${encodeURIComponent('E2E Produto A1')}`, sessionB);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.some((p: any) => p.id === TENANT_A_PRODUCT)).toBe(false);
  });

  it('cria produto com novos campos de catálogo e SKU automático', async () => {
    const session = await login();
    const barcode = `980${String(Date.now()).slice(-9)}`;
    const create = await authenticatedFetch('/api/produtos', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'E2E Catálogo Completo',
        preco: '250.00',
        categoria: 'Elétrica',
        subcategoria: 'Iluminação',
        marca: 'E2E Marca',
        modelo: 'M-100',
        unidade: 'cx',
        purchasePrice: '150.00',
        barcode,
        description: 'Produto de teste de catálogo',
      }),
    });
    expect(create.status).toBe(200);
    const created = await create.json();
    expect(created.produto.codigo).toMatch(/^SKU-/);
    expect(created.produto.marca).toBe('E2E Marca');
    expect(created.produto.barcode).toBe(barcode);
    expect(created.produto.unidade).toBe('cx');

    const search = await authenticatedFetch(`/api/produtos/search?marca=${encodeURIComponent('E2E Marca')}`, session);
    const searchData = await search.json();
    expect(searchData.items.some((p: any) => p.id === created.id)).toBe(true);

    const del = await authenticatedFetch(`/api/produtos/${created.id}`, session, { method: 'DELETE' });
    expect(del.status).toBe(200);
  });
});
