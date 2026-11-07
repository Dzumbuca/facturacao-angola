import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSessionTenantId: vi.fn(), getSessionUserId: vi.fn() }));
vi.mock('@/lib/tenant-db', () => ({ runWithTenant: vi.fn() }));

const mkReq = (b: any) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) });
const baseItem = { purchaseOrderItemId: 'poi1', productId: 'p1', quantity: 2 };

function pwsMocks() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    productWarehouseStock: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'pws1' }),
      update: vi.fn().mockResolvedValue({ id: 'pws1' }),
      upsert: vi.fn().mockResolvedValue({ id: 'pws1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('POST /api/stock/purchase/receptions', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 sem tenant (utilizador não autorizado no tenant)', async () => {
    vi.mocked(auth).mockResolvedValue({} as any);
    vi.mocked(getSessionTenantId).mockReturnValue(null);
    expect((await POST(mkReq({}))).status).toBe(401);
  });

  it('400 payload inválido (falta warehouseId)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    expect((await POST(mkReq({ purchaseOrderId: 'po1', items: [baseItem] }))).status).toBe(400);
    expect((await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [] }))).status).toBe(400);
  });

  it('404 quando PO/armazém não pertence ao tenant (lookup tenant-scoped)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const findPO = vi.fn().mockResolvedValue(null);
    const findWh = vi.fn().mockResolvedValue({ id: 'w1' });
    vi.mocked(runWithTenant).mockImplementation(async (tenantId, fn) => {
      expect(tenantId).toBe('t1');
      return fn({ purchaseOrder: { findFirst: findPO }, warehouse: { findFirst: findWh } } as any);
    });
    const res = await POST(mkReq({ purchaseOrderId: 'po-other', warehouseId: 'w1', items: [baseItem] }));
    expect(res.status).toBe(404);
    expect(findPO).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'po-other', tenantId: 't1' } }));
    expect(findWh).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w1', tenantId: 't1', isActive: true } }));
  });

  it('404 quando produto do item não pertence ao tenant', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const findProduct = vi.fn().mockResolvedValue(null);
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      purchaseOrder: { findFirst: vi.fn().mockResolvedValue({ id: 'po1', tenantId: 't1', status: 'PENDING', items: [{ id: 'poi1', productId: 'p1', quantity: 5, receivedQty: 0 }] }) },
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w1' }) },
      product: { findFirst: findProduct },
    } as any));
    const res = await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [baseItem] }));
    expect(res.status).toBe(404);
    expect(findProduct).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', tenantId: 't1' } }));
  });

  it('404 quando lote não pertence ao tenant/produto', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      purchaseOrder: { findFirst: vi.fn().mockResolvedValue({ id: 'po1', tenantId: 't1', status: 'PENDING', items: [{ id: 'poi1', productId: 'p1', quantity: 5, receivedQty: 0 }] }) },
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w1' }) },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
      stockLot: { findFirst: vi.fn().mockResolvedValue(null) },
    } as any));
    const res = await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [{ ...baseItem, lotId: 'lot-other' }] }));
    expect(res.status).toBe(404);
  });

  it('409 operação repetida (PO já RECEIVED)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      purchaseOrder: { findFirst: vi.fn().mockResolvedValue({ id: 'po1', tenantId: 't1', status: 'RECEIVED', items: [{ id: 'poi1', productId: 'p1', quantity: 5, receivedQty: 5 }] }) },
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w1' }) },
    } as any));
    expect((await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [baseItem] }))).status).toBe(409);
  });

  it('400 estado/item inválido (item não pertence à PO ou qty excede pendente)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      purchaseOrder: { findFirst: vi.fn().mockResolvedValue({ id: 'po1', tenantId: 't1', status: 'PENDING', items: [{ id: 'poi1', productId: 'p1', quantity: 1, receivedQty: 0 }] }) },
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w1' }) },
    } as any));
    expect((await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [{ purchaseOrderItemId: 'poi-x', productId: 'p1', quantity: 1 }] }))).status).toBe(400);
    expect((await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [{ purchaseOrderItemId: 'poi1', productId: 'p1', quantity: 5 }] }))).status).toBe(400);
  });

  it('falha durante transacção não mascara erro de domínio (propaga como 500 interno mapeado)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    vi.mocked(runWithTenant).mockImplementation(async () => { throw new Error('db tx failure'); });
    expect((await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [baseItem] }))).status).toBe(500);
  });

  it('sucesso: mutações tenant-scoped, receivedQty atualizado, PO PARCIAL/RECEIVED conforme pendente', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(getSessionTenantId).mockReturnValue('t1');
    vi.mocked(getSessionUserId).mockReturnValue('u1');
    const productUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const poiUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const movementCreate = vi.fn().mockResolvedValue({ id: 'm1' });
    const poUpdate = vi.fn().mockResolvedValue({ id: 'po1' });
    const pws = pwsMocks();
    vi.mocked(runWithTenant).mockImplementation(async (_t, fn) => fn({
      ...pws,
      purchaseOrder: {
        findFirst: vi.fn().mockResolvedValue({ id: 'po1', tenantId: 't1', status: 'PENDING', items: [{ id: 'poi1', productId: 'p1', quantity: 5, receivedQty: 0 }] }),
        update: poUpdate,
      },
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'w1' }) },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }), updateMany: productUpdateMany },
      purchaseOrderItem: {
        updateMany: poiUpdateMany,
        findMany: vi.fn().mockResolvedValue([{ quantity: 5, receivedQty: 2 }]),
      },
      purchaseReception: { create: vi.fn().mockResolvedValue({ id: 'rec1', reference: 'REC-X', items: [{ purchaseOrderItemId: 'poi1', productId: 'p1', quantity: 2 }] }) },
      stockMovement: { create: movementCreate },
    } as any));
    const res = await POST(mkReq({ purchaseOrderId: 'po1', warehouseId: 'w1', items: [baseItem], reference: 'REC-X' }));
    expect(res.status).toBe(201);
    expect(productUpdateMany.mock.calls[0][0].where).toEqual({ id: 'p1', tenantId: 't1' });
    expect(poiUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'poi1', tenantId: 't1', purchaseOrderId: 'po1' }, data: { receivedQty: { increment: 2 } } }));
    expect(movementCreate.mock.calls[0][0].data.idempotencyKey).toContain('poi1');
    expect(movementCreate.mock.calls[0][0].data.purchaseReceptionId).toBe('rec1');
    expect(poUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'po1', tenantId: 't1' }, data: { status: 'PARCIAL', receivedAt: null } }));
    expect(pws.productWarehouseStock.create).toHaveBeenCalled();
  });
});
