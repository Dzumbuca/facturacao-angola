// E2E HTTP: controlo comercial do WMS por pacote.
// Cria uma empresa nova (Grátis) isolada, testa bloqueio, upgrade, downgrade e
// preservação dos dados de stock. Corre contra a BD descartável.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
const EMAIL = `e2e-access-${stamp}@machinefacturas.test`;
const PASSWORD = 'TestPass123!';

let tenantId = '';
let userId = '';
let productId = '';

beforeAll(async () => {
  const tenant = await prisma.tenant.create({
    data: { name: `E2E Acesso ${stamp}`, nif: null, plan: 'FREE', status: 'ACTIVE' },
  });
  tenantId = tenant.id;
  const password = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      name: 'E2E Acesso',
      email: EMAIL,
      password,
      tenantId,
      tenantRole: 'COMPANY_ADMIN',
      platformRole: 'NONE',
      emailVerificationRequired: false,
    },
  });
  userId = user.id;
  const product = await prisma.product.create({
    data: { tenantId, name: 'E2E Produto Preservado', price: 10, stock: 7 },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.productWarehouseStock.deleteMany({ where: { tenantId } });
  await prisma.warehouse.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.tenantApplication.deleteMany({ where: { tenantId } });
  await prisma.tenantSubscription.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

describe('WMS - controlo de acesso por pacote', () => {
  it('empresa Grátis nova não acede às páginas nem às APIs do WMS', async () => {
    const session = await login(EMAIL, PASSWORD);

    for (const path of ['/warehouses', '/stock']) {
      const page = await authenticatedFetch(path, session, { redirect: 'manual' });
      expect([307, 308], path).toContain(page.status);
      expect(page.headers.get('location') || '', path).toContain('/apps?wms=bloqueado');
    }

    const api = await authenticatedFetch('/api/stock/warehouses', session);
    expect(api.status).toBe(403);

    const movement = await authenticatedFetch('/api/stock/movements', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, warehouseId: 'x', type: 'IN', quantity: 1 }),
    });
    expect(movement.status).toBe(403);
  });

  it('upgrade para pacote pago activa; downgrade bloqueia e preserva o stock', async () => {
    const session = await login(EMAIL, PASSWORD);
    const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'basico' } });
    const gratis = await prisma.subscriptionPlan.findUnique({ where: { slug: 'gratis' } });
    const app = await prisma.platformApplication.findUnique({ where: { slug: 'wms' } });
    expect(plan && gratis && app).toBeTruthy();

    await prisma.tenantSubscription.create({
      data: { tenantId, planId: plan!.id, status: 'ACTIVE', startsAt: new Date(), endsAt: null, autoRenew: false },
    });
    await prisma.tenantApplication.upsert({
      where: { tenantId_applicationId: { tenantId, applicationId: app!.id } },
      update: { enabled: true },
      create: { tenantId, applicationId: app!.id, enabled: true, enabledAt: new Date() },
    });

    const allowed = await authenticatedFetch('/api/stock/warehouses', session);
    expect(allowed.status).toBe(200);
    const warehousePage = await authenticatedFetch('/warehouses', session, { redirect: 'manual' });
    expect(warehousePage.status).toBe(200);

    const warehouse = await prisma.warehouse.create({
      data: { tenantId, name: 'Armazém preservado', isActive: true, isDefault: true },
    });
    await prisma.productWarehouseStock.create({
      data: { tenantId, productId, warehouseId: warehouse.id, quantity: 7 },
    });

    await prisma.tenantSubscription.deleteMany({ where: { tenantId } });
    await prisma.tenantSubscription.create({
      data: { tenantId, planId: gratis!.id, status: 'ACTIVE', startsAt: new Date(), endsAt: null, autoRenew: false },
    });
    await prisma.tenantApplication.update({
      where: { tenantId_applicationId: { tenantId, applicationId: app!.id } },
      data: { enabled: false },
    });

    const blockedPage = await authenticatedFetch('/warehouses', session, { redirect: 'manual' });
    expect([307, 308]).toContain(blockedPage.status);
    const blockedApi = await authenticatedFetch('/api/stock/warehouses', session);
    expect(blockedApi.status).toBe(403);

    const preserved = await prisma.productWarehouseStock.findFirst({ where: { tenantId, warehouseId: warehouse.id } });
    expect(Number(preserved?.quantity)).toBe(7);
    expect(await prisma.warehouse.findFirst({ where: { id: warehouse.id, tenantId } })).toBeTruthy();
  });
});
