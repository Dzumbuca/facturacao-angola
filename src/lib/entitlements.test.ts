import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const isApplicationEnabled = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { tenantSubscription: { findFirst: (...args: any[]) => findFirst(...args) } },
}));
vi.mock('@/lib/platform-apps', () => ({
  isApplicationEnabled: (...args: any[]) => isApplicationEnabled(...args),
}));

import { getTenantWmsLimits, getWarehouseLimitStatus, decideWmsAccess } from './entitlements';

describe('entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa os limites do plano da subscrição activa', async () => {
    findFirst.mockResolvedValue({
      status: 'ACTIVE',
      endsAt: null,
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

  it('subscrição expirada cai para Grátis (sem grandfathering)', async () => {
    findFirst.mockResolvedValue({
      status: 'ACTIVE',
      endsAt: new Date('2020-01-01T00:00:00Z'),
      plan: { slug: 'profissional', limits: [{ metric: 'max_warehouses', value: 3 }] },
    });
    isApplicationEnabled.mockResolvedValue(true);
    const limits = await getTenantWmsLimits('t1');
    expect(limits).toMatchObject({ planSlug: 'gratis', grandfathered: false, maxWarehouses: 0, maxProducts: 30 });
  });

  it('bloqueia criação quando o uso atinge o limite', async () => {
    const tx = {
      tenantSubscription: { findFirst: vi.fn().mockResolvedValue({ status: 'ACTIVE', endsAt: null, plan: { slug: 'basico', limits: [{ metric: 'max_warehouses', value: 1 }] } }) },
      warehouse: { count: vi.fn().mockResolvedValue(1) },
    };
    const status = await getWarehouseLimitStatus(tx, 't1');
    expect(status).toEqual({ allowed: false, limit: 1, used: 1 });
  });

  it('permite criação abaixo do limite', async () => {
    const tx = {
      tenantSubscription: { findFirst: vi.fn().mockResolvedValue({ status: 'ACTIVE', endsAt: null, plan: { slug: 'profissional', limits: [{ metric: 'max_warehouses', value: 3 }] } }) },
      warehouse: { count: vi.fn().mockResolvedValue(2) },
    };
    const status = await getWarehouseLimitStatus(tx, 't1');
    expect(status).toEqual({ allowed: true, limit: 3, used: 2 });
  });

  describe('acesso ao WMS por pacote', () => {
    const base = { maxStockProducts: null, maxProducts: null, maxClients: null, maxSuppliers: null, maxInvoicesPerMonth: null, capabilities: { transfers: false } };

    it('Grátis sem módulo → bloqueado', () => {
      expect(decideWmsAccess({ ...base, planSlug: 'gratis', maxWarehouses: 0, grandfathered: false }, false).allowed).toBe(false);
    });

    it('Grátis com subscrição explícita e módulo ligado → continua bloqueado', () => {
      expect(decideWmsAccess({ ...base, planSlug: 'gratis', maxWarehouses: 0, grandfathered: false }, true).allowed).toBe(false);
    });

    it('Básico com WMS → permitido', () => {
      expect(decideWmsAccess({ ...base, planSlug: 'basico', maxWarehouses: 1, grandfathered: false }, true).allowed).toBe(true);
    });

    it('pacote pago sem linha TenantApplication → permitido pelo pacote', () => {
      expect(decideWmsAccess({ ...base, planSlug: 'profissional', maxWarehouses: 3, grandfathered: false }, false).allowed).toBe(true);
    });

    it('tenant legado (grandfathering) mantém acesso', () => {
      expect(decideWmsAccess({ ...base, planSlug: 'empresarial', maxWarehouses: null, grandfathered: true }, true).allowed).toBe(true);
    });

    it('subscrição expirada cai para Grátis e bloqueia', () => {
      expect(decideWmsAccess({ ...base, planSlug: 'gratis', maxWarehouses: 0, grandfathered: false }, true).allowed).toBe(false);
    });
  });
});
