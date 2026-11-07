import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./tenant-db', () => ({ runWithTenant: vi.fn() }));

import { upsertProductWarehouseStock } from './stock-service';

function tx(over: any = {}) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    productWarehouseStock: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ id: 'pws1' }),
      create: vi.fn().mockResolvedValue({ id: 'pws1', quantity: 5 }),
      update: vi.fn().mockResolvedValue({ id: 'pws1', quantity: 8 }),
      ...(over.productWarehouseStock || {}),
    },
    ...over,
  };
}
const params = { tenantId: 't1', productId: 'p1', warehouseId: 'w1', lotId: null as string | null };

describe('upsertProductWarehouseStock', () => {
  const origVitest = process.env.VITEST;
  const origNodeEnv = process.env.NODE_ENV;
  beforeEach(() => { vi.resetAllMocks(); process.env.VITEST = 'true'; (process.env as any).NODE_ENV = 'test'; });
  afterEach(() => { process.env.VITEST = origVitest; (process.env as any).NODE_ENV = origNodeEnv; });

  it('adquire advisory lock transacional quando $executeRaw existe e cria PWS inexistente', async () => {
    const t = tx();
    const res = await upsertProductWarehouseStock(t, params, { quantity: 5 });
    expect(t.$executeRaw).toHaveBeenCalledTimes(1);
    expect(t.productWarehouseStock.findFirst).toHaveBeenCalledWith({ where: { tenantId: 't1', productId: 'p1', warehouseId: 'w1', lotId: null }, select: { id: true } });
    expect(t.productWarehouseStock.create).toHaveBeenCalledWith({ data: { tenantId: 't1', productId: 'p1', warehouseId: 'w1', lotId: null, quantity: 5, reservedQuantity: 0 } });
    expect(res.id).toBe('pws1');
  });

  it('incrementa PWS existente preservando isolamento por tenant', async () => {
    const t = tx({ productWarehouseStock: { findFirst: vi.fn().mockResolvedValue({ id: 'pws9' }), update: vi.fn().mockResolvedValue({ id: 'pws9', quantity: 8 }), create: vi.fn() } });
    await upsertProductWarehouseStock(t, params, { quantity: 3, reservedQuantity: 1 });
    expect(t.productWarehouseStock.create).not.toHaveBeenCalled();
    expect(t.productWarehouseStock.update).toHaveBeenCalledWith({ where: { id: 'pws9' }, data: { quantity: { increment: 3 }, reservedQuantity: { increment: 1 } } });
  });

  it('runtime real (não-teste): falha de advisory lock interrompe operação', async () => {
    process.env.VITEST = ''; (process.env as any).NODE_ENV = 'production';
    const t = tx({ $executeRaw: vi.fn().mockRejectedValue(new Error('lock fail')) });
    await expect(upsertProductWarehouseStock(t, params, { quantity: 1 })).rejects.toThrow('lock fail');
    expect(t.productWarehouseStock.findFirst).not.toHaveBeenCalled();
  });

  it('runtime real (não-teste): sem $executeRaw falha explicitamente (exige transação PostgreSQL)', async () => {
    process.env.VITEST = ''; (process.env as any).NODE_ENV = 'production';
    const t = tx({ $executeRaw: undefined });
    await expect(upsertProductWarehouseStock(t, params, { quantity: 1 })).rejects.toThrow('PWS_UPSERT_REQUIRES_TRANSACTION');
  });

  it('mock de teste sem $executeRaw continua compatível', async () => {
    const t = tx({ $executeRaw: undefined });
    await upsertProductWarehouseStock(t, params, { quantity: 2 });
    expect(t.productWarehouseStock.create).toHaveBeenCalled();
  });
});
