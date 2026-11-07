// tests/e2e/wms/wms-flows.test.ts
// Fluxos operacionais reais do WMS v2 contra a BD descartável com APIs reais.
import { describe, it, expect } from 'vitest';
import { login, authenticatedFetch } from './http-auth-harness';

const SUPPLIER_A = 'e2e00000-0000-0000-0000-ssssssssssss';
const PRODUCT_A1 = 'e2e00000-0000-0000-0000-ppppppppppp1';
const PRODUCT_A2 = 'e2e00000-0000-0000-0000-ppppppppppp2';
const WAREHOUSE_A = 'e2e00000-0000-0000-0000-aaaaaaaaaaaa';
const WAREHOUSE_A2 = 'e2e00000-0000-0000-0000-cccccccccccc';

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('WMS v2 E2E - Compras e receções', () => {
  it('encomenda → receção parcial → receção total atualiza estado e stock', async () => {
    const session = await login();

    const poRes = await authenticatedFetch('/api/stock/purchase/orders', session, json({
      supplierId: SUPPLIER_A,
      items: [{ productId: PRODUCT_A1, quantity: 5, unitPrice: 10 }],
    }));
    expect(poRes.status).toBe(201);
    const po = await poRes.json();
    expect(po.id).toBeTruthy();
    expect(po.items).toHaveLength(1);
    const itemId = po.items[0].id;

    const r1 = await authenticatedFetch('/api/stock/purchase/receptions', session, json({
      purchaseOrderId: po.id,
      warehouseId: WAREHOUSE_A,
      items: [{ purchaseOrderItemId: itemId, productId: PRODUCT_A1, quantity: 4 }],
    }));
    expect(r1.status).toBe(201);

    const afterPartial = await (await authenticatedFetch('/api/stock/purchase/orders', session)).json();
    expect(afterPartial.find((o: any) => o.id === po.id)?.status).toBe('PARCIAL');

    const r2 = await authenticatedFetch('/api/stock/purchase/receptions', session, json({
      purchaseOrderId: po.id,
      warehouseId: WAREHOUSE_A,
      items: [{ purchaseOrderItemId: itemId, productId: PRODUCT_A1, quantity: 1 }],
    }));
    expect(r2.status).toBe(201);

    const afterFull = await (await authenticatedFetch('/api/stock/purchase/orders', session)).json();
    expect(afterFull.find((o: any) => o.id === po.id)?.status).toBe('RECEIVED');
  });

  it('rejeita receção com quantidade superior ao restante (400)', async () => {
    const session = await login();
    const poRes = await authenticatedFetch('/api/stock/purchase/orders', session, json({
      supplierId: SUPPLIER_A,
      items: [{ productId: PRODUCT_A1, quantity: 1, unitPrice: 5 }],
    }));
    const po = await poRes.json();
    const res = await authenticatedFetch('/api/stock/purchase/receptions', session, json({
      purchaseOrderId: po.id,
      warehouseId: WAREHOUSE_A,
      items: [{ purchaseOrderItemId: po.items[0].id, productId: PRODUCT_A1, quantity: 99 }],
    }));
    expect(res.status).toBe(400);
  });
});

describe('WMS v2 E2E - Transferências', () => {
  it('cria, expede e recebe transferência entre armazéns', async () => {
    const session = await login();
    const create = await authenticatedFetch('/api/stock/transfers', session, json({
      fromWarehouseId: WAREHOUSE_A,
      toWarehouseId: WAREHOUSE_A2,
      items: [{ productId: PRODUCT_A1, quantity: 2 }],
    }));
    expect(create.status).toBe(201);
    const transfer = await create.json();

    const dispatch = await authenticatedFetch(`/api/stock/transfers/${transfer.id}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'DISPATCH' }),
    });
    expect(dispatch.status).toBe(200);

    const receive = await authenticatedFetch(`/api/stock/transfers/${transfer.id}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'RECEIVE' }),
    });
    expect(receive.status).toBe(200);
    const received = await receive.json();
    expect(received.status).toBe('RECEIVED');
  });
});

describe('WMS v2 E2E - Ajustes de inventário', () => {
  it('aumenta e reduz stock com registo de ajuste fechado', async () => {
    const session = await login();

    const increase = await authenticatedFetch('/api/stock/adjustments', session, json({
      warehouseId: WAREHOUSE_A,
      reason: 'E2E ajuste aumento',
      items: [{ productId: PRODUCT_A2, quantity: 1, type: 'INCREASE' }],
    }));
    expect(increase.status).toBe(201);
    const incBody = await increase.json();
    expect(incBody.status).toBe('CLOSED');
    expect(incBody.items[0].difference).toBeTruthy();

    const decrease = await authenticatedFetch('/api/stock/adjustments', session, json({
      warehouseId: WAREHOUSE_A,
      reason: 'E2E ajuste redução',
      items: [{ productId: PRODUCT_A2, quantity: 1, type: 'DECREASE' }],
    }));
    expect(decrease.status).toBe(201);
  });

  it('rejeita redução superior ao stock disponível (400)', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/adjustments', session, json({
      warehouseId: WAREHOUSE_A,
      reason: 'E2E ajuste inválido',
      items: [{ productId: PRODUCT_A2, quantity: 9999, type: 'DECREASE' }],
    }));
    expect(res.status).toBe(400);
  });
});

describe('WMS v2 E2E - Reservas', () => {
  it('cria reserva e liberta-a, devolvendo disponibilidade', async () => {
    const session = await login();
    const create = await authenticatedFetch('/api/stock/reservations', session, json({
      productId: PRODUCT_A1,
      warehouseId: WAREHOUSE_A,
      quantity: 1,
      orderReference: `E2E-RES-${Date.now()}`,
    }));
    expect(create.status).toBe(201);
    const resv = await create.json();
    expect(resv.status).toBe('ACTIVE');

    const release = await authenticatedFetch(`/api/stock/reservations/${resv.id}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'RELEASE' }),
    });
    expect(release.status).toBe(200);
    const released = await release.json();
    expect(released.status).toBe('RELEASED');
  });
});

describe('WMS v2 E2E - Lotes', () => {
  it('cria lote e lista-o por produto', async () => {
    const session = await login();
    const lotNumber = `E2E-LOT-${Date.now()}`;
    const create = await authenticatedFetch('/api/stock/lots', session, json({
      productId: PRODUCT_A1,
      lotNumber,
      expiryDate: '2028-12-31',
    }));
    expect(create.status).toBe(201);

    const list = await authenticatedFetch(`/api/stock/lots?productId=${PRODUCT_A1}`, session);
    expect(list.status).toBe(200);
    const lots = await list.json();
    expect(lots.some((l: any) => l.lotNumber === lotNumber)).toBe(true);
  });
});

describe('WMS v2 E2E - Saldos e consultas', () => {
  it('GET /api/stock/balances devolve saldos com produto e armazém', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock/balances', session);
    expect(res.status).toBe(200);
    const balances = await res.json();
    expect(Array.isArray(balances)).toBe(true);
    expect(balances.length).toBeGreaterThan(0);
    expect(balances[0].product?.name).toBeTruthy();
  });
});

describe('WMS v2 E2E - Movimentos diretos (IN/OUT)', () => {
  const balanceOf = async (session: any): Promise<number> => {
    const res = await authenticatedFetch(`/api/stock/balances?warehouseId=${WAREHOUSE_A}&productId=${PRODUCT_A1}`, session);
    expect(res.status).toBe(200);
    const rows = await res.json();
    return rows.reduce((sum: number, r: any) => sum + Number(r.quantity || 0), 0);
  };

  it('sem sessão devolve 401', async () => {
    const res = await fetch(`${process.env.APP_URL || 'http://localhost:3002'}/api/stock/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('IN incrementa e OUT repõe o saldo; OUT insuficiente devolve 400', async () => {
    const session = await login();
    const before = await balanceOf(session);

    const inn = await authenticatedFetch('/api/stock/movements', session, json({
      productId: PRODUCT_A1, warehouseId: WAREHOUSE_A, type: 'IN', quantity: 2, reason: 'E2E movimento IN',
    }));
    expect(inn.status).toBe(201);
    expect(await balanceOf(session)).toBe(before + 2);

    const out = await authenticatedFetch('/api/stock/movements', session, json({
      productId: PRODUCT_A1, warehouseId: WAREHOUSE_A, type: 'OUT', quantity: 2, reason: 'E2E movimento OUT',
    }));
    expect(out.status).toBe(201);
    expect(await balanceOf(session)).toBe(before);

    const insufficient = await authenticatedFetch('/api/stock/movements', session, json({
      productId: PRODUCT_A1, warehouseId: WAREHOUSE_A, type: 'OUT', quantity: 999999, reason: 'E2E insuficiente',
    }));
    expect(insufficient.status).toBe(400);
    expect(await balanceOf(session)).toBe(before);
  });
});
