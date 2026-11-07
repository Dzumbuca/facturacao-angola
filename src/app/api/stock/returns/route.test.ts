import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { registerPhysicalReturn } from '@/lib/stock-service';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));
vi.mock('@/lib/stock-service', () => ({ registerPhysicalReturn: vi.fn() }));

function mockReturnsTx(overrides: { total?: number; items?: any[] } = {}) {
  const calls: any = { findMany: null, count: null };
  const tx = {
    stockMovement: {
      count: vi.fn().mockImplementation(async (a) => { calls.count = a; return overrides.total ?? 0; }),
      findMany: vi.fn().mockImplementation(async (a) => { calls.findMany = a; return overrides.items ?? []; }),
    },
  };
  return { tx, calls };
}

describe('GET /api/stock/returns', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    const res = await GET(new Request('http://x/api/stock/returns'));
    expect(res.status).toBe(401);
  });

  it('lista apenas movimentos de devolução com paginação', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const { tx, calls } = mockReturnsTx({ total: 5, items: [{ id: 'r1' }] });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));

    const res = await GET(new Request('http://x/api/stock/returns?page=3&limit=2&reference=NC%201/2026&productId=p1&warehouseId=w1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.total).toBe(5);
    expect(json.page).toBe(3);
    expect(json.limit).toBe(2);
    expect(json.totalPages).toBe(3);
    expect(calls.findMany.skip).toBe(4);
    expect(calls.findMany.take).toBe(2);
    expect(calls.findMany.where.idempotencyKey).toEqual({ startsWith: 'return-' });
    expect(calls.findMany.where.reference).toEqual({ contains: 'NC 1/2026', mode: 'insensitive' });
    expect(calls.findMany.include.warehouse).toBeTruthy();
  });

  it('limita o page size ao máximo de 200', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue(null);
    const { tx, calls } = mockReturnsTx({ total: 0, items: [] });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx as any));

    const res = await GET(new Request('http://x/api/stock/returns?limit=1000'));
    const json = await res.json();
    expect(json.limit).toBe(200);
    expect(calls.findMany.where.tenantId).toBe('t1');
  });
});

describe('POST /api/stock/returns', () => {
  beforeEach(() => vi.resetAllMocks());

  it('retorna 401 sem tenant', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({}) }));
    expect(res.status).toBe(401);
  });

  it('valida dados obrigatorios', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ productId: 'p' }) }));
    expect(res.status).toBe(400);
  });

  it('regista devolucao fisica idempotente via service', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(registerPhysicalReturn).mockResolvedValue({ movement: { id: 'm1' } } as any);
    const res = await POST(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ productId: 'p1', warehouseId: 'w1', quantity: 2, creditNoteId: 'nc1' }),
    }));
    expect(res.status).toBe(201);
    expect(registerPhysicalReturn).toHaveBeenCalledWith('t1', expect.objectContaining({ productId: 'p1', warehouseId: 'w1', quantity: 2, creditNoteId: 'nc1', createdByUserId: 'u1' }));
  });
});
