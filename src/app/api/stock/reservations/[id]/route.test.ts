import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PATCH } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));

const ctx = { params: Promise.resolve({ id: 'r1' }) };
const mkReq = (b: any) => new Request('http://x', { method: 'PATCH', body: JSON.stringify(b) }) as any;
const resv = (over: any = {}) => ({ id: 'r1', tenantId: 't1', status: 'ACTIVE', productId: 'p1', quantity: 3, stockId: 's1', ...over });

describe('PATCH /api/stock/reservations/[id]', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    expect((await PATCH(mkReq({ action: 'RELEASE' }), ctx)).status).toBe(401);
  });

  it('404 reserva de outro tenant/inexistente (lookup tenant-scoped)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    const findFirst = vi.fn().mockResolvedValue(null);
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({ stockReservation: { findFirst } } as any));
    expect((await PATCH(mkReq({ action: 'RELEASE' }), ctx)).status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'r1', tenantId: 't1' } });
  });

  it('400 estado inválido (reserva não ACTIVE)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      stockReservation: { findFirst: vi.fn().mockResolvedValue(resv({ status: 'RELEASED' })) },
    } as any));
    expect((await PATCH(mkReq({ action: 'RELEASE' }), ctx)).status).toBe(400);
  });

  it('400 operação repetida/ação inválida (FULFILL em estado já tratado)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      stockReservation: { findFirst: vi.fn().mockResolvedValue(resv({ status: 'FULFILLED' })) },
    } as any));
    expect((await PATCH(mkReq({ action: 'FULFILL' }), ctx)).status).toBe(400);
  });

  it('404 quando produto não pertence ao tenant no RELEASE (defesa em profundidade)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      stockReservation: { findFirst: vi.fn().mockResolvedValue(resv({ productId: 'p-other' })) },
      product: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as any));
    expect((await PATCH(mkReq({ action: 'RELEASE' }), ctx)).status).toBe(404);
  });

  it('falha durante transacção propaga como 500', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(runWithTenant).mockImplementation(async () => { throw new Error('tx fail'); });
    expect((await PATCH(mkReq({ action: 'RELEASE' }), ctx)).status).toBe(500);
  });

  it('RELEASE sucesso: produto/PWS/reserva atualizados com tenantId + ACTIVE e releasedAt', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    const prodUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const resvUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const pwsUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      stockReservation: { findFirst: vi.fn().mockResolvedValue(resv()), updateMany: resvUpdateMany },
      product: { updateMany: prodUpdateMany },
      productWarehouseStock: { updateMany: pwsUpdateMany },
    } as any));
    const response = await PATCH(mkReq({ action: 'RELEASE' }), ctx);
    expect(response.status).toBe(200);
    expect(prodUpdateMany.mock.calls[0][0].where).toEqual({ id: 'p1', tenantId: 't1' });
    expect(resvUpdateMany.mock.calls[0][0].where).toEqual({ id: 'r1', tenantId: 't1', status: 'ACTIVE' });
    expect(resvUpdateMany.mock.calls[0][0].data.status).toBe('RELEASED');
    expect(resvUpdateMany.mock.calls[0][0].data.releasedAt).toBeInstanceOf(Date);
    expect(pwsUpdateMany).toHaveBeenCalled();
  });

  it('EXPIRE exige ACTIVE e atualiza com tenantId (concorrência: updateMany count=0)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      stockReservation: { findFirst: vi.fn().mockResolvedValue(resv()), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      product: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      productWarehouseStock: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as any));
    expect((await PATCH(mkReq({ action: 'EXPIRE' }), ctx)).status).toBe(400);
  });
});