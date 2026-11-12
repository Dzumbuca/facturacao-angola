// E2E HTTP — adiantamentos e empréstimos (descontos recorrentes).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
let tenantAId = '';
let employeeId = '';
let deductionId = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
});

afterAll(async () => {
  if (employeeId) await prisma.rhEmployee.deleteMany({ where: { tenantId: tenantAId, id: employeeId } });
  await prisma.$disconnect();
});

describe('Machine RH — adiantamentos e empréstimos', () => {
  it('cria desconto, lista e desactiva', async () => {
    const admin = await login();
    const employee = await authenticatedFetch('/api/rh/employees', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Adv', lastName: `E2E${stamp}`, hireDate: '2026-03-01', baseSalary: 300000 }),
    });
    expect(employee.status).toBe(201);
    employeeId = (await employee.json()).id;

    const created = await authenticatedFetch('/api/rh/deductions', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, description: 'Adiantamento salário', type: 'ADIANTAMENTO', amount: 50000, remainingInstallments: 3 }),
    });
    expect(created.status).toBe(201);
    const createdData = await created.json();
    deductionId = createdData.id;
    expect(createdData.amount).toBe(50000);
    expect(createdData.remainingInstallments).toBe(3);

    const list = await authenticatedFetch(`/api/rh/deductions?employeeId=${employeeId}`, admin);
    expect(list.status).toBe(200);
    const listData = await list.json();
    expect(listData.some((item: any) => item.id === deductionId)).toBe(true);

    const off = await authenticatedFetch(`/api/rh/deductions/${deductionId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    expect(off.status).toBe(200);
    expect((await off.json()).active).toBe(false);

    const bad = await authenticatedFetch('/api/rh/deductions', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, description: 'X', amount: 0 }),
    });
    expect(bad.status).toBe(400);
  });

  it('isolamento por empresa', async () => {
    const sessionB = await login('e2e-other@machinefacturas.test');
    const foreign = await authenticatedFetch(`/api/rh/deductions/${deductionId}`, sessionB, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true }),
    });
    expect(foreign.status).toBe(404);
  });
});
