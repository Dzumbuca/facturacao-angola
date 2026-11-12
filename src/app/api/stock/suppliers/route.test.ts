import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { getCountLimitStatus } from '@/lib/entitlements';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));
vi.mock('@/lib/entitlements', () => ({ getCountLimitStatus: vi.fn() }));

const mkReq = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
const COMPANY_TX = () => ({ $executeRaw: vi.fn().mockResolvedValue([]), supplier: { count: vi.fn().mockResolvedValue(5), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'sup1', name: 'Teste' }) } } as any);

describe('POST /api/stock/suppliers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
  });

  it('401 sem tenant', async () => {
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    expect((await POST(mkReq({}))).status).toBe(401);
  });

  it('400 nome inválido', async () => {
    expect((await POST(mkReq({ name: '' }))).status).toBe(400);
    expect((await POST(mkReq({}))).status).toBe(400);
  });

  it('403 limite de fornecedores atingido', async () => {
    vi.mocked(getCountLimitStatus).mockResolvedValue({ allowed: false, limit: 10, used: 10 } as any);
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(COMPANY_TX()));
    const res = await POST(mkReq({ name: 'Novo Fornecedor' }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('LIMIT_REACHED');
  });

  it('201 cria fornecedor quando abaixo do limite', async () => {
    vi.mocked(getCountLimitStatus).mockResolvedValue({ allowed: true, limit: 10, used: 5 } as any);
    const tx = COMPANY_TX();
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx));
    const res = await POST(mkReq({ name: 'Fornecedor A', nif: '541000001', email: 'a@example.com' }));
    expect(res.status).toBe(201);
    expect(tx.supplier.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Fornecedor A' }) });
  });

  it('409 fornecedor duplicado (case-insensitive)', async () => {
    vi.mocked(getCountLimitStatus).mockResolvedValue({ allowed: true, limit: 10, used: 5 } as any);
    const tx = COMPANY_TX();
    tx.supplier.findFirst = vi.fn().mockResolvedValue({ id: 'sup-exists' });
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn(tx));
    const res = await POST(mkReq({ name: 'Fornecedor A' }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('NAME_EXISTS');
  });
});
