import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));

const mkReq = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) });

describe('POST /api/stock/lots', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    expect((await POST(mkReq({ productId: 'p1', lotNumber: 'L1' }))).status).toBe(401);
  });

  it('400 payload inválido (faltam campos obrigatórios)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    expect((await POST(mkReq({ productId: 'p1' }))).status).toBe(400);
    expect((await POST(mkReq({ lotNumber: 'L1' }))).status).toBe(400);
  });

  it('404 quando produto não pertence ao tenant (tenant-scoped)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const findProduct = vi.fn().mockResolvedValue(null);
    vi.mocked(runWithTenant).mockImplementation(async (tenantId, fn) => {
      expect(tenantId).toBe('t1');
      return fn({ product: { findFirst: findProduct } } as any);
    });
    const res = await POST(mkReq({ productId: 'p-other', lotNumber: 'L1' }));
    expect(res.status).toBe(404);
    expect(findProduct).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p-other', tenantId: 't1' } }));
  });

  it('409 quando lote duplicado no tenant/produto', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
      stockLot: { findFirst: vi.fn().mockResolvedValue({ id: 'dup' }) },
    } as any));
    expect((await POST(mkReq({ productId: 'p1', lotNumber: 'L1' }))).status).toBe(409);
  });

  it('201 cria lote com campos schema-compatíveis e ignora quantity/manufactureDate (sem migration)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const create = vi.fn().mockResolvedValue({ id: 'lot1', tenantId: 't1', productId: 'p1', lotNumber: 'L1' });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
      stockLot: { findFirst: vi.fn().mockResolvedValue(null), create },
    } as any));
    const res = await POST(mkReq({ productId: 'p1', lotNumber: ' L1 ', quantity: 99, manufactureDate: '2026-01-01', expiryDate: '2027-01-01', receivedAt: '2026-02-01' }));
    expect(res.status).toBe(201);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenantId: 't1', productId: 'p1', lotNumber: 'L1' });
    expect(data.quantity).toBeUndefined();
    expect(data.manufactureDate).toBeUndefined();
    expect(data.expiryDate).toBeInstanceOf(Date);
    expect(data.receivedAt).toBeInstanceOf(Date);
  });
});
