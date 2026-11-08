// tests/e2e/wms/wms-packages.test.ts
// Pacotes: catálogo gratuito sem stock + limites de armazéns por plano.
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const TENANT_A = 'e2e00000-0000-0000-0000-000000000001';
const TENANT_B = 'e2e00000-0000-0000-0000-000000000002';
const USER_B = 'e2e-other@machinefacturas.test';

async function setWms(tenantId: string, enabled: boolean) {
  const app = await prisma.platformApplication.findUniqueOrThrow({ where: { slug: 'wms' } });
  await prisma.tenantApplication.upsert({
    where: { tenantId_applicationId: { tenantId, applicationId: app.id } },
    update: { enabled, enabledAt: enabled ? new Date() : null, disabledAt: enabled ? null : new Date() },
    create: { tenantId, applicationId: app.id, enabled, enabledAt: enabled ? new Date() : null, disabledAt: enabled ? null : new Date() },
  });
}

async function setPlan(tenantId: string, slug: string | null) {
  await prisma.tenantSubscription.deleteMany({ where: { tenantId } });
  if (!slug) return;
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug } });
  await prisma.tenantSubscription.create({
    data: { tenantId, planId: plan.id, status: 'ACTIVE', startsAt: new Date(), endsAt: null, autoRenew: false },
  });
}

afterAll(async () => {
  await setPlan(TENANT_A, null).catch(() => {});
  await setWms(TENANT_B, true).catch(() => {});
  await prisma.$disconnect().catch(() => {});
});

describe('Pacotes — catálogo gratuito sem gestão de stock', () => {
  it('bloqueia stock no produto sem WMS e permite catálogo normal', async () => {
    const session = await login(USER_B);
    await setWms(TENANT_B, false);
    try {
      const withStock = await authenticatedFetch('/api/produtos', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'E2E Serviço', preco: 1000, stock: 5 }),
      });
      expect(withStock.status).toBe(403);
      expect(await withStock.json()).toMatchObject({ code: 'STOCK_REQUIRES_WMS' });

      const catalogOnly = await authenticatedFetch('/api/produtos', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'E2E Serviço', preco: 1000 }),
      });
      expect(catalogOnly.status).toBe(200);
      const created = await catalogOnly.json();
      expect(Number(created.produto.stock)).toBe(0);
      expect(created.produto.trackStock).toBe(false);

      const edited = await authenticatedFetch(`/api/produtos/${created.id}`, session, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: 3 }),
      });
      expect(edited.status).toBe(403);

      const deleted = await authenticatedFetch(`/api/produtos/${created.id}`, session, { method: 'DELETE' });
      expect(deleted.status).toBe(200);
    } finally {
      await setWms(TENANT_B, true);
    }
  });
});

describe('Pacotes — limites de catálogo e transferências', () => {
  it('bloqueia criação de produtos acima do limite do plano', async () => {
    const session = await login();
    const used = await prisma.product.count({ where: { tenantId: TENANT_A } });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        slug: `teste-prod-${Date.now()}`,
        name: 'Teste limite produtos',
        priceKz: 0,
        billingCycle: 'MONTHLY',
        isActive: false,
        limits: { create: [{ metric: 'max_products', value: used }] },
      },
    });
    await prisma.tenantSubscription.create({ data: { tenantId: TENANT_A, planId: plan.id, status: 'ACTIVE', startsAt: new Date(), endsAt: null, autoRenew: false } });
    try {
      const blocked = await authenticatedFetch('/api/produtos', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'E2E Acima do Limite', preco: 100 }),
      });
      expect(blocked.status).toBe(403);
      expect(await blocked.json()).toMatchObject({ code: 'LIMIT_REACHED', metric: 'max_products' });
    } finally {
      await prisma.tenantSubscription.deleteMany({ where: { tenantId: TENANT_A } });
      await prisma.subscriptionPlan.delete({ where: { id: plan.id } }).catch(() => {});
    }
  });

  it('Básico não transfere entre armazéns; Profissional permite', async () => {
    const session = await login();
    const payload = {
      fromWarehouseId: '00000000-0000-0000-0000-000000000000',
      toWarehouseId: '00000000-0000-0000-0000-000000000001',
      items: [{ productId: '00000000-0000-0000-0000-000000000002', quantity: 1 }],
    };
    await setPlan(TENANT_A, 'basico');
    try {
      const blocked = await authenticatedFetch('/api/stock/transfers', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(blocked.status).toBe(403);
      expect(await blocked.json()).toMatchObject({ code: 'CAPABILITY_REQUIRED', capability: 'transfers' });
    } finally {
      await setPlan(TENANT_A, 'profissional');
    }
    try {
      const allowed = await authenticatedFetch('/api/stock/transfers', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(allowed.status).not.toBe(403);
    } finally {
      await setPlan(TENANT_A, null);
    }
  });
});

describe('Pacotes — limite de armazéns', () => {
  it('Básico (1 armazém) bloqueia, preserva dados e grandfathering restaura', async () => {
    const session = await login();
    await setPlan(TENANT_A, 'basico');
    try {
      const before = await (await authenticatedFetch('/api/stock/warehouses', session)).json();
      expect(Array.isArray(before)).toBe(true);
      expect(before.length).toBeGreaterThanOrEqual(2);

      const blocked = await authenticatedFetch('/api/stock/warehouses', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'E2E Excedente' }),
      });
      expect(blocked.status).toBe(403);
      expect(await blocked.json()).toMatchObject({ code: 'LIMIT_REACHED', metric: 'max_warehouses', limit: 1 });

      const after = await (await authenticatedFetch('/api/stock/warehouses', session)).json();
      expect(after.length).toBe(before.length);
    } finally {
      await setPlan(TENANT_A, null);
    }

    // Sem subscrição, o tenant legado volta a não ter limite (grandfathering).
    const created = await authenticatedFetch('/api/stock/warehouses', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Livre ${Date.now()}` }),
    });
    expect(created.status).toBe(201);
    const warehouse = await created.json();
    await authenticatedFetch(`/api/stock/warehouses/${warehouse.id}`, session, { method: 'DELETE' });
  });

  it('Profissional (3 armazéns) permite até ao limite', async () => {
    const session = await login();
    await setPlan(TENANT_A, 'profissional');
    const createdIds: string[] = [];
    try {
      const list = await (await authenticatedFetch('/api/stock/warehouses', session)).json();
      const used = list.length;
      const allowed = Math.max(0, 3 - used);
      for (let i = 0; i < allowed; i += 1) {
        const res = await authenticatedFetch('/api/stock/warehouses', session, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `E2E Prof ${i}-${Date.now()}` }),
        });
        expect(res.status).toBe(201);
        createdIds.push((await res.json()).id);
      }
      const blocked = await authenticatedFetch('/api/stock/warehouses', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'E2E Excessivo' }),
      });
      expect(blocked.status).toBe(403);
    } finally {
      for (const id of createdIds) {
        await authenticatedFetch(`/api/stock/warehouses/${id}`, session, { method: 'DELETE' });
      }
      await setPlan(TENANT_A, null);
    }
  });
});

describe('Relatórios de armazém', () => {
  it('exportação de stock exige WMS (403) e funciona com WMS (200)', async () => {
    const sessionB = await login(USER_B);
    await setWms(TENANT_B, false);
    try {
      const blocked = await authenticatedFetch('/api/reports/export?kind=stock_balances&format=csv', sessionB);
      expect(blocked.status).toBe(403);
      expect(await blocked.json()).toMatchObject({ code: 'APP_NOT_ENABLED' });
    } finally {
      await setWms(TENANT_B, true);
    }

    const sessionA = await login();
    const allowed = await authenticatedFetch('/api/reports/export?kind=stock_balances&format=csv', sessionA);
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain('Produto');
  });
});
