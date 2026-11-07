import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));
vi.mock('crypto', () => ({ default: { randomUUID: () => 'uuid' }, randomUUID: () => 'uuid' }));

function mkReq(body: any, url = 'http://x') { return new Request(url, { method: 'POST', body: JSON.stringify(body) }); }
function mkGet(url: string) { return new Request(url); }

function mockMovementTx(overrides: any = {}) {
  const calls: any = { findMany: null, count: null };
  const tx = {
    stockMovement: {
      count: vi.fn().mockImplementation(async (a) => { calls.count = a; return overrides.total ?? 0; }),
      findMany: vi.fn().mockImplementation(async (a) => { calls.findMany = a; return overrides.items ?? []; }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (a) => ({ id: 'm1', ...a.data })),
    },
    product: { findFirst: vi.fn().mockResolvedValue({ id: 'p', tenantId: 't1' }), update: vi.fn().mockResolvedValue({ id: 'p' }) },
    warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w', isActive: true }) },
    productWarehouseStock: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'pws', quantity: 3 }),
      update: vi.fn().mockResolvedValue({ id: 'pws' }),
    },
    ...overrides.tx,
  };
  return { tx, calls };
}

describe('GET /api/stock/movements', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    const res = await GET(mkGet('http://x/api/stock/movements'));
    expect(res.status).toBe(401);
  });

  it('devolve itens paginados com metadados', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const { tx, calls } = mockMovementTx({ total: 3, items: [{ id: 'm1' }] });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));

    const res = await GET(mkGet('http://x/api/stock/movements?page=2&limit=2&type=OUT&productId=p1&warehouseId=w1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.total).toBe(3);
    expect(json.page).toBe(2);
    expect(json.limit).toBe(2);
    expect(json.totalPages).toBe(2);
    expect(calls.findMany.skip).toBe(2);
    expect(calls.findMany.take).toBe(2);
    expect(calls.findMany.where.type).toBe('OUT');
    expect(calls.findMany.where.productId).toBe('p1');
    expect(calls.findMany.where.warehouseId).toBe('w1');
    expect(calls.findMany.where.tenantId).toBe('t1');
  });

  it('limita o page size ao máximo de 200 e ignora tipo inválido', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue(null);
    const { tx, calls } = mockMovementTx({ total: 0, items: [] });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));

    const res = await GET(mkGet('http://x/api/stock/movements?limit=9999&type=HACK'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.limit).toBe(200);
    expect(calls.findMany.where.type).toBeUndefined();
  });

  it('aplica filtro de datas quando from/to válidos', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue(null);
    const { tx, calls } = mockMovementTx({ total: 0, items: [] });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));

    await GET(mkGet('http://x/api/stock/movements?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z'));
    expect(calls.findMany.where.createdAt.gte).toBeInstanceOf(Date);
    expect(calls.findMany.where.createdAt.lte).toBeInstanceOf(Date);
  });
});

describe('POST /api/stock/movements', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    expect((await POST(mkReq({}))).status).toBe(401);
  });

  it('400 sem warehouseId', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    const res = await POST(mkReq({ productId: 'p', type: 'IN', quantity: 1 }));
    expect(res.status).toBe(400);
  });

  it('IN cria movimento e atualiza ProductWarehouseStock + Product', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    const { tx } = mockMovementTx();
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));
    const res = await POST(mkReq({ productId: 'p', warehouseId: 'w', type: 'IN', quantity: 3, reason: 'r', idempotencyKey: 'k1' }));
    expect(res.status).toBe(201);
    const body = { create: (tx.productWarehouseStock.create as any).mock.calls[0][0], prodUpdate: (tx.product.update as any).mock.calls[0][0], created: (tx.stockMovement.create as any).mock.calls[0][0] };
    expect(body.create.data.quantity).toBe(3);
    expect(body.create.data.lotId).toBeNull();
    expect(body.prodUpdate.data.stock.increment).toBe(3);
    expect(body.created.data.quantitySigned).toBe(3);
    expect(body.created.data.idempotencyKey).toBe('k1');
  });

  it('OUT falha com stock insuficiente no armazem', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    const { tx } = mockMovementTx({
      tx: {
        productWarehouseStock: { findFirst: vi.fn().mockResolvedValue({ id: 'pws', quantity: 1 }), update: vi.fn() },
      },
    });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));
    const res = await POST(mkReq({ productId: 'p', warehouseId: 'w', type: 'OUT', quantity: 5 }));
    expect(res.status).toBe(400);
  });

  it('idempotencia retorna movimento existente', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    const { tx } = mockMovementTx({ tx: { stockMovement: { findFirst: vi.fn().mockResolvedValue({ id: 'm-existing', idempotencyKey: 'k1' }), count: vi.fn(), findMany: vi.fn(), create: vi.fn() } } });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));
    const res = await POST(mkReq({ productId: 'p', warehouseId: 'w', type: 'IN', quantity: 1, idempotencyKey: 'k1' }));
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.id).toBe('m-existing');
  });
});
