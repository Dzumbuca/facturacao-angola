// E2E HTTP — avaliação de desempenho.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
let tenantAId = '';
let employeeId = '';
let cycleId = '';
let reviewId = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
});

afterAll(async () => {
  if (employeeId) await prisma.rhEmployee.deleteMany({ where: { tenantId: tenantAId, id: employeeId } });
  if (cycleId) await prisma.rhPerformanceCycle.deleteMany({ where: { tenantId: tenantAId, id: cycleId } });
  await prisma.$disconnect();
});

describe('Machine RH — avaliação de desempenho', () => {
  it('cria ciclo com critérios, gera avaliações e valida', async () => {
    const admin = await login();
    const employee = await authenticatedFetch('/api/rh/employees', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Perf', lastName: `E2E${stamp}`, hireDate: '2026-01-05', baseSalary: 200000 }),
    });
    expect(employee.status).toBe(201);
    const employeeData = await employee.json();
    employeeId = employeeData.id;

    const cycle = await authenticatedFetch('/api/rh/performance/cycles', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `E2E Ciclo ${stamp}`,
        startsAt: '2026-05-01',
        endsAt: '2026-06-30',
        criteria: [{ name: 'Produtividade', weight: 2 }, { name: 'Colaboração', weight: 1 }],
      }),
    });
    expect(cycle.status).toBe(201);
    const cycleData = await cycle.json();
    cycleId = cycleData.id;

    const generate = await authenticatedFetch(`/api/rh/performance/cycles/${cycleId}`, admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(generate.status).toBe(200);

    const list = await authenticatedFetch('/api/rh/performance/cycles', admin);
    const listData = await list.json();
    const mine = listData.find((item: any) => item.id === cycleId);
    expect(mine.criteria.length).toBe(2);
    expect(mine._count.reviews).toBeGreaterThan(0);

    const review = mine.reviews.find((item: any) => item.employee.employeeNumber);
    reviewId = review.id;

    const submitted = await authenticatedFetch(`/api/rh/performance/reviews/${reviewId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: 85, comments: 'Bom desempenho', reviewerName: 'E2E Manager' }),
    });
    expect(submitted.status).toBe(200);
    const validated = await authenticatedFetch(`/api/rh/performance/reviews/${reviewId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VALIDADO' }),
    });
    expect(validated.status).toBe(200);
    expect((await validated.json()).status).toBe('VALIDADO');

    const badScore = await authenticatedFetch(`/api/rh/performance/reviews/${reviewId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: 150 }),
    });
    expect(badScore.status).toBe(400);

    const closed = await authenticatedFetch(`/api/rh/performance/cycles/${cycleId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    });
    expect(closed.status).toBe(200);

    const locked = await authenticatedFetch(`/api/rh/performance/reviews/${reviewId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ENTREGUE' }),
    });
    expect(locked.status).toBe(409);
  });

  it('isolamento por empresa', async () => {
    const sessionB = await login('e2e-other@machinefacturas.test');
    const foreign = await authenticatedFetch(`/api/rh/performance/cycles/${cycleId}`, sessionB, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    });
    expect(foreign.status).toBe(404);
  });
});
