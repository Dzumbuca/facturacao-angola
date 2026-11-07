import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));
vi.mock('@/lib/entitlements', () => ({
  getTenantWmsLimits: vi.fn().mockResolvedValue({ capabilities: { transfers: true }, maxWarehouses: null }),
}));

describe('POST /api/stock/transfers', () => {
  beforeEach(() => vi.clearAllMocks());
  it('cria transferencia PENDING com items', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u');
    const create = vi.fn().mockResolvedValue({ id: 'tr1', status: 'PENDING', items: [{ productId: 'p' }] });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      warehouse: { findFirst: vi.fn().mockResolvedValueOnce({ id: 'wa' }).mockResolvedValueOnce({ id: 'wb' }) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p' }]) },
      stockTransfer: { create },
    } as any));
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ fromWarehouseId: 'wa', toWarehouseId: 'wb', items: [{ productId: 'p', quantity: 2 }] }) }));
    expect(res.status).toBe(201);
    const data = create.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
    expect(data.items.create[0].quantity).toBe(2);
    expect(data.items.create[0].product.connect).toEqual({ tenantId_id: { tenantId: 't1', id: 'p' } });
  });
});
