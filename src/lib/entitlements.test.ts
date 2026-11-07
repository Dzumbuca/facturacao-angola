import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const isApplicationEnabled = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { tenantSubscription: { findFirst: (...args: any[]) => findFirst(...args) } },
}));
vi.mock('@/lib/platform-apps', () => ({
  isApplicationEnabled: (...args: any[]) => isApplicationEnabled(...args),
}));

import { getTenantWmsLimits, getWarehouseLimitStatus } from './entitlements';

describe('entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa os limites do plano da subscrição activa', async () => {
    findFirst.mockResolvedValue({
      plan: {
        slug: 'profissional',
        limits: [
          { metric: 'max_warehouses', value: 3 },
          { metric: 'max_stock_products', value: null },
        ],
      },
    });
    const limits = await getTenantWmsLimits('t1');
    expect(limits).toMatchObject({ planSlug: 'profissional', maxWarehouses: 3, maxStockProducts: null, capabilities: { transfers: false } });
    expect(isApplicationEnabled).not.toHaveBeenCalled();
  });

  it('sem subscrição mas com WMS activo → grandfathering sem limites', async () => {
    findFirst.mockResolvedValue(null);
    isApplicationEnabled.mockResolvedValue(true);
    const limits = await getTenantWmsLimits('t1');
    expect(limits).toMatchObject({ grandfathered: true, maxWarehouses: null });
  });

  it('sem subscrição e sem WMS → Grátis (0 armazéns)', async () => {
    findFirst.mockResolvedValue(null);
    isApplicationEnabled.mockResolvedValue(false);
    const limits = await getTenantWmsLimits('t1');
    expect(limits).toMatchObject({ planSlug: 'gratis', maxWarehouses: 0, maxProducts: 30, maxClients: 30, maxInvoicesPerMonth: 15, capabilities: { transfers: false }, grandfathered: false });
  });

  it('bloqueia criação quando o uso atinge o limite', async () => {
    const tx = {
      tenantSubscription: { findFirst: vi.fn().mockResolvedValue({ plan: { slug: 'basico', limits: [{ metric: 'max_warehouses', value: 1 }] } }) },
      warehouse: { count: vi.fn().mockResolvedValue(1) },
    };
    const status = await getWarehouseLimitStatus(tx, 't1');
    expect(status).toEqual({ allowed: false, limit: 1, used: 1 });
  });

  it('permite criação abaixo do limite', async () => {
    const tx = {
      tenantSubscription: { findFirst: vi.fn().mockResolvedValue({ plan: { slug: 'profissional', limits: [{ metric: 'max_warehouses', value: 3 }] } }) },
      warehouse: { count: vi.fn().mockResolvedValue(2) },
    };
    const status = await getWarehouseLimitStatus(tx, 't1');
    expect(status).toEqual({ allowed: true, limit: 3, used: 2 });
  });
});
