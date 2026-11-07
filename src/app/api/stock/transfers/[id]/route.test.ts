import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PATCH } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));
vi.mock('@/lib/entitlements', () => ({
  getTenantWmsLimits: vi.fn().mockResolvedValue({ capabilities: { transfers: true }, maxWarehouses: null }),
}));

const ctx = { params: Promise.resolve({ id: 'tr1' }) };
const mkReq = (b: any) => new Request('http://x', { method: 'PATCH', body: JSON.stringify(b) }) as any;

describe('PATCH /api/stock/transfers/[id]', () => {
  beforeEach(() => vi.clearAllMocks());
  it('DISPATCH move stock origem e cria movimento OUT', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    const pwsUpdate = vi.fn().mockResolvedValue({});
    const moveCreate = vi.fn().mockResolvedValue({});
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      stockTransfer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'tr1', status: 'PENDING', fromWarehouseId: 'wa', toWarehouseId: 'wb', reference: 'TRF', items: [{ id: 'it1', productId: 'p', quantity: 2, lotId: null }] }),
        update: vi.fn().mockResolvedValue({ id: 'tr1', status: 'IN_TRANSIT' }),
      },
      productWarehouseStock: { findFirst: vi.fn().mockResolvedValue({ id: 'pws', quantity: 5 }), update: pwsUpdate },
      product: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      stockMovement: { create: moveCreate },
    } as any));
    const res = await PATCH(mkReq({ action: 'DISPATCH' }), ctx);
    expect(res.status).toBe(200);
    expect(pwsUpdate.mock.calls[0][0].data.quantity.decrement).toBe(2);
    expect(moveCreate.mock.calls[0][0].data.type).toBe('OUT');
  });

  it('acao invalida retorna 400', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      stockTransfer: { findFirst: vi.fn().mockResolvedValue({ id: 'tr1', status: 'RECEIVED', items: [] }) },
    } as any));
    expect((await PATCH(mkReq({ action: 'DISPATCH' }), ctx)).status).toBe(400);
  });
});