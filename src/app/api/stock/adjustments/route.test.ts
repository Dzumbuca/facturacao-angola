import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));

const mkReq = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) });

describe('POST /api/stock/adjustments', () => {
  beforeEach(() => vi.resetAllMocks());

  it('valida payload', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    expect((await POST(mkReq({}))).status).toBe(400);
  });

  it('INCREASE registra ajuste fechado, item de contagem e movimento de entrada', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    const prodUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const itemCreate = vi.fn().mockResolvedValue({ id: 'item1' });
    const moveCreate = vi.fn().mockResolvedValue({ id: 'm' });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      $executeRaw: vi.fn().mockResolvedValue(1),
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w' }) },
      stockAdjustment: {
        create: vi.fn().mockResolvedValue({ id: 'adj' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'adj', status: 'CLOSED', items: [] }),
      },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p' }), updateMany: prodUpdate },
      productWarehouseStock: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'pws1', quantity: 0 }),
        update: vi.fn().mockResolvedValue({ id: 'pws1' }),
      },
      stockAdjustmentItem: { create: itemCreate },
      stockMovement: { create: moveCreate },
    } as any));
    const res = await POST(mkReq({ warehouseId: 'w', reason: 'inv', items: [{ productId: 'p', quantity: 4, type: 'INCREASE' }] }));
    expect(res.status).toBe(201);
    expect(itemCreate.mock.calls[0][0].data.systemQty).toBe(0);
    expect(itemCreate.mock.calls[0][0].data.countedQty).toBe(4);
    expect(itemCreate.mock.calls[0][0].data.difference).toBe(4);
    expect(prodUpdate.mock.calls[0][0].data.stock.increment).toBe(4);
    expect(moveCreate.mock.calls[0][0].data.quantitySigned).toBe(4);
  });

  it('DECREASE bloqueia stock insuficiente no armazem', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      $executeRaw: vi.fn().mockResolvedValue(1),
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w' }) },
      stockAdjustment: { create: vi.fn().mockResolvedValue({ id: 'adj' }), findFirst: vi.fn() },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p' }), updateMany: vi.fn() },
      productWarehouseStock: { findFirst: vi.fn().mockResolvedValue({ id: 'pws', quantity: 1 }) },
      stockAdjustmentItem: { create: vi.fn() },
      stockMovement: { create: vi.fn() },
    } as any));
    const res = await POST(mkReq({ warehouseId: 'w', reason: 'inv', items: [{ productId: 'p', quantity: 5, type: 'DECREASE' }] }));
    expect(res.status).toBe(400);
  });
});
