import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSessionTenantId: vi.fn(),
}));

vi.mock('@/lib/tenant-db', () => ({
  runWithTenant: vi.fn(),
}));

describe('GET /api/stock', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retorna 401 se não autenticado', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);

    const req = new Request('http://localhost:3000/api/stock');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('retorna apenas movimentos do próprio tenant', async () => {
    const session = { user: { id: 'u1', tenantId: 'tenant-1' } };
    vi.mocked(auth).mockResolvedValue(session as any);
    vi.mocked(getSessionTenantId).mockReturnValue('tenant-1');

    const movements = [
      { id: 'm1', tenantId: 'tenant-1', productId: 'p1', type: 'IN', quantity: 10 },
    ];

    vi.mocked(runWithTenant).mockImplementation(async (tenantId, fn) => {
      expect(tenantId).toBe('tenant-1');
      return fn({
        stockMovement: {
          findMany: vi.fn().mockResolvedValue(movements),
        },
      });
    });

    const req = new Request('http://localhost:3000/api/stock');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(movements);
    expect(runWithTenant).toHaveBeenCalled();
  });

  it('ignora tenantId enviado na query string', async () => {
    const session = { user: { id: 'u1', tenantId: 'tenant-1' } };
    vi.mocked(auth).mockResolvedValue(session as any);
    vi.mocked(getSessionTenantId).mockReturnValue('tenant-1');

    vi.mocked(runWithTenant).mockImplementation(async (tenantId, fn) => {
      expect(tenantId).toBe('tenant-1');
      return fn({
        stockMovement: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      });
    });

    const req = new Request('http://localhost:3000/api/stock?tenantId=tenant-2');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(runWithTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
  });

  it('aplica filtros productId, type e days', async () => {
    const session = { user: { id: 'u1', tenantId: 'tenant-1' } };
    vi.mocked(auth).mockResolvedValue(session as any);
    vi.mocked(getSessionTenantId).mockReturnValue('tenant-1');

    const findMany = vi.fn().mockResolvedValue([]);
    vi.mocked(runWithTenant).mockImplementation(async (tenantId, fn) => {
      return fn({
        stockMovement: {
          findMany,
        },
      });
    });

    const req = new Request('http://localhost:3000/api/stock?productId=p1&type=OUT&days=7');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalled();
    const callArgs = findMany.mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe('tenant-1');
    expect(callArgs.where.productId).toBe('p1');
    expect(callArgs.where.type).toBe('OUT');
    expect(callArgs.where.createdAt).toBeDefined();
    expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);
  });
});
