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
