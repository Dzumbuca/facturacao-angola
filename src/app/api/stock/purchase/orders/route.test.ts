import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));

const mkReq = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) });

describe('POST /api/stock/purchase/orders', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    expect((await POST(mkReq({}))).status).toBe(401);
  });

  it('400 payload inválido', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    expect((await POST(mkReq({ supplierId: 's1', items: [] }))).status).toBe(400);
  });

  it('404 fornecedor não pertence ao tenant', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const findSupplier = vi.fn().mockResolvedValue(null);
    vi.mocked(runWithTenant).mockImplementation(async (tenantId, fn) => {
      expect(tenantId).toBe('t1');
      return fn({ supplier: { findFirst: findSupplier } } as any);
    });
    const res = await POST(mkReq({ supplierId: 's-other', items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }] }));
    expect(res.status).toBe(404);
    expect(findSupplier).toHaveBeenCalledWith({ where: { id: 's-other', tenantId: 't1' } });
  });

  it('201 cria ordem com campos suportados; warehouseId/notes não persistidos e devolve avisos explícitos (sem migration)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const create = vi.fn().mockResolvedValue({ id: 'po1', tenantId: 't1', supplierId: 's1', status: 'PENDENTE', total: 20, items: [], supplier: { id: 's1' } });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      supplier: { findFirst: vi.fn().mockResolvedValue({ id: 's1' }) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1' }]) },
      purchaseOrder: { create },
    } as any));
    const res = await POST(mkReq({ supplierId: 's1', warehouseId: 'w1', notes: 'obs', items: [{ productId: 'p1', quantity: 2, unitPrice: 10 }] }));
    expect(res.status).toBe(201);
    const data = create.mock.calls[0][0].data;
    expect(data.warehouseId).toBeUndefined();
    expect(data.notes).toBeUndefined();
    expect(data.supplierId).toBe('s1');
    expect(data.total).toBe(20);
    expect(data.items.create[0].product.connect).toEqual({ tenantId_id: { tenantId: 't1', id: 'p1' } });
    expect(data.items.create[0].tenantId).toBeUndefined();
    expect(data.items.create[0].productId).toBeUndefined();
    const body = await res.json();
    expect(body.warnings?.join(' ')).toMatch(/warehouseId/);
    expect(body.warnings?.join(' ')).toMatch(/notes/);
    expect(body.warehouseNote).toMatch(/receção/i);
  });
});
