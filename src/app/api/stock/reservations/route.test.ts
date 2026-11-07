import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));

const mkReq = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) });

function baseTx(over: any = {}) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    product: {
      findFirst: vi.fn().mockResolvedValue({ id: 'p1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...(over.product || {}),
    },
    warehouse: {
      findFirst: vi.fn().mockResolvedValue({ id: 'w1' }),
      ...(over.warehouse || {}),
    },
    productWarehouseStock: {
      findFirst: vi.fn().mockResolvedValue({ id: 's1', quantity: 10, reservedQuantity: 0 }),
      findUnique: vi.fn().mockResolvedValue({ id: 's1', quantity: 10, reservedQuantity: 0 }),
      create: vi.fn().mockResolvedValue({ id: 's1', quantity: 0, reservedQuantity: 0 }),
      update: vi.fn().mockResolvedValue({ id: 's1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...(over.productWarehouseStock || {}),
    },
    stockReservation: {
      create: vi.fn().mockResolvedValue({ id: 'r1', tenantId: 't1', productId: 'p1', warehouseId: 'w1', stockId: 's1', quantity: 2, status: 'ACTIVE' }),
      ...(over.stockReservation || {}),
    },
    ...over,
  };
}

describe('POST /api/stock/reservations', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    expect((await POST(mkReq({ productId: 'p1', warehouseId: 'w1', quantity: 1 }))).status).toBe(401);
  });

  it('400 payload inválido / qty inválida', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    expect((await POST(mkReq({ productId: 'p1' }))).status).toBe(400);
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(baseTx() as any));
    expect((await POST(mkReq({ productId: 'p1', warehouseId: 'w1', quantity: 0 }))).status).toBe(400);
  });

  it('404 produto/armazém inexistente ou de outro tenant (lookup tenant-scoped)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const findWh = vi.fn().mockResolvedValue(null);
    vi.mocked(runWithTenant).mockImplementation(async (tenantId, fn) => {
      expect(tenantId).toBe('t1');
      return fn(baseTx({ warehouse: { findFirst: findWh } }) as any);
    });
    const res = await POST(mkReq({ productId: 'p1', warehouseId: 'w-other', quantity: 1 }));
    expect(res.status).toBe(404);
    expect(findWh).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w-other', tenantId: 't1', isActive: true } }));
  });

  it('400 stock insuficiente (PWS sem saldo e sem fallback global)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(baseTx({
      productWarehouseStock: { findFirst: vi.fn().mockResolvedValue({ id: 's1' }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }) as any));
    expect((await POST(mkReq({ productId: 'p1', warehouseId: 'w1', quantity: 5 }))).status).toBe(400);
  });

  it('201 reserva com saldo PWS: decrementa PWS.quantity, incrementa reservedQuantity, decrementa Product.stock (consistência)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const pwsUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prodUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const resCreate = vi.fn().mockResolvedValue({ id: 'r1', stockId: 's1', status: 'ACTIVE' });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(baseTx({
      productWarehouseStock: { findFirst: vi.fn().mockResolvedValue({ id: 's1' }), updateMany: pwsUpdateMany },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }), updateMany: prodUpdateMany },
      stockReservation: { create: resCreate },
    }) as any));
    const res = await POST(mkReq({ productId: 'p1', warehouseId: 'w1', quantity: 2, orderReference: 'ORD-1' }));
    expect(res.status).toBe(201);
    expect(pwsUpdateMany).toHaveBeenCalledWith({ where: { id: 's1', tenantId: 't1', quantity: { gte: 2 } }, data: { quantity: { decrement: 2 }, reservedQuantity: { increment: 2 } } });
    expect(prodUpdateMany).toHaveBeenCalledWith({ where: { id: 'p1', tenantId: 't1', stock: { gte: 2 } }, data: { stock: { decrement: 2 } } });
    expect(resCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', productId: 'p1', warehouseId: 'w1', stockId: 's1', quantity: 2, status: 'ACTIVE', orderReference: 'ORD-1' }) }));
  });

  it('201 bootstrap PWS quando não existe (helper) e usa stock global legado com reservedQuantity no PWS', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const pwsFindFirst = vi.fn().mockResolvedValue(null);
    const pwsCreate = vi.fn().mockResolvedValue({ id: 's-new', quantity: 0, reservedQuantity: 0 });
    const pwsUpdateMany = vi.fn()
      .mockResolvedValueOnce({ count: 0 }) // no PWS balance
      .mockResolvedValueOnce({ count: 1 }); // reservedQuantity increment
    const prodUpdateMany = vi.fn().mockResolvedValue({ count: 1 }); // legacy global stock
    const resCreate = vi.fn().mockResolvedValue({ id: 'r1', stockId: 's-new', status: 'ACTIVE' });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(baseTx({
      productWarehouseStock: { findFirst: pwsFindFirst, create: pwsCreate, updateMany: pwsUpdateMany, update: vi.fn(), findUnique: vi.fn() },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }), updateMany: prodUpdateMany },
      stockReservation: { create: resCreate },
    }) as any));
    const res = await POST(mkReq({ productId: 'p1', warehouseId: 'w1', quantity: 1 }));
    expect(res.status).toBe(201);
    expect(pwsCreate).toHaveBeenCalled();
    expect(prodUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', tenantId: 't1', stock: { gte: 1 } } }));
    expect(resCreate.mock.calls[0][0].data.stockId).toBe('s-new');
  });
});
