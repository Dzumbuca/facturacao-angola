// E2E HTTP — fornecedores e plano com max_suppliers.
import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
const passwordHashPromise = bcrypt.hash('TestPass123!', 10);
const tenantId = `e2e-suppliers-${stamp}-0000-0000-0000-000000000000`;
const otherEmail = `e2e-suppliers-other-${stamp}@machinefacturas.test`;
const userId = `e2e-suppliers-user-${stamp}`;

const FIXTURES = { tenantId, otherEmail, userId };
const tempSupplierName = `E2E Fornecedor ${stamp}`;
const updatedSupplierName = `E2E Fornecedor ${stamp} atualizado`;

beforeAll(async () => {
  const passwordHash = await passwordHashPromise;
  await prisma.tenant.create({ data: { id: tenantId, name: `E2E Suppliers ${stamp}`, nif: '500000111', plan: 'FREE', status: 'ACTIVE' } });
  await prisma.user.create({
    data: {
      id: userId,
      name: 'E2E Suppliers Admin',
      email: otherEmail,
      password: passwordHash,
      tenantId,
      tenantRole: 'COMPANY_ADMIN',
      platformRole: 'NONE',
      emailVerificationRequired: false,
      emailVerified: new Date(),
    },
  });
  // Cria um plano custom para testar o limite de fornecedores
  const plan = await prisma.subscriptionPlan.create({
    data: {
      slug: `plan-suppliers-limit-${stamp}`,
      name: `Plano Suppliers Limit ${stamp}`,
      description: 'Plano de teste para limite de fornecedores',
      priceKz: 10,
      priceYearly: 100,
      billingCycle: 'MONTHLY',
      isBundle: false,
      isActive: true,
    },
  });
  await prisma.planLimit.create({ data: { planId: plan.id, metric: 'max_suppliers', value: 1 } });
  await prisma.tenantSubscription.create({
    data: { tenantId, planId: plan.id, status: 'ACTIVE', startsAt: new Date(), endsAt: null, autoRenew: false },
  });
  // Enable WMS for this tenant so suppliers endpoint isn't blocked
  const wmsApp = await prisma.platformApplication.findUniqueOrThrow({ where: { slug: 'wms' } });
  await prisma.tenantApplication.upsert({
    where: { tenantId_applicationId: { tenantId, applicationId: wmsApp.id } },
    update: { enabled: true, enabledAt: new Date(), disabledAt: null },
    create: { tenantId, applicationId: wmsApp.id, enabled: true, enabledAt: new Date(), disabledAt: null },
  });
});

afterAll(async () => {
  await prisma.tenantSubscription.deleteMany({ where: { tenantId } });
  const plan = await prisma.subscriptionPlan.findFirst({ where: { slug: `plan-suppliers-limit-${stamp}` } });
  if (plan) {
    await prisma.planLimit.deleteMany({ where: { planId: plan.id } });
    await prisma.planApplication.deleteMany({ where: { planId: plan.id } });
    await prisma.subscriptionPlan.delete({ where: { id: plan.id } });
  }
  await prisma.supplier.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

describe('Fornecedores — CRUD e limite de plano', () => {
  it('cria, lê, actualiza e apaga fornecedor', async () => {
    const session = await login(otherEmail, 'TestPass123!');

    // Create
    const createRes = await authenticatedFetch('/api/stock/suppliers', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tempSupplierName, nif: '900000001', email: 'e2e-suppliers@example.com', phone: '+244 923 000 000' }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(tempSupplierName);

    // List
    const listRes = await authenticatedFetch('/api/stock/suppliers', session);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.some((s: any) => s.id === created.id)).toBe(true);

    // Patch
    const patchRes = await authenticatedFetch(`/api/stock/suppliers/${created.id}`, session, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: updatedSupplierName, nif: '900000002', email: 'updated@example.com', phone: '+244 924 000 000', contact: 'Contacto E2E', address: 'Rua E2E 123' }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.name).toBe(updatedSupplierName);
    expect(updated.nif).toBe('900000002');

    // Delete
    const deleteRes = await authenticatedFetch(`/api/stock/suppliers/${created.id}`, session, { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    const listAfter = await authenticatedFetch('/api/stock/suppliers', session);
    const listData = await listAfter.json();
    expect(listData.some((s: any) => s.id === created.id)).toBe(false);
  });

  it('bloqueia criação quando o limite de fornecedores é atingido', async () => {
    const session = await login(otherEmail, 'TestPass123!');

    // Create first supplier (should be allowed, limit is 1)
    const first = await authenticatedFetch('/api/stock/suppliers', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Supplier Limit First ${stamp}` }),
    });
    expect(first.status).toBe(201);

    // Second should be blocked
    const second = await authenticatedFetch('/api/stock/suppliers', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Supplier Limit Second ${stamp}` }),
    });
    expect(second.status).toBe(403);
    const body = await second.json();
    expect(body.code).toBe('LIMIT_REACHED');
    expect(body.metric).toBe('max_suppliers');
  });
});
