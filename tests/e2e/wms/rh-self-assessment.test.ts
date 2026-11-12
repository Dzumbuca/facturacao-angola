// E2E HTTP — self-assessment (Meu RH).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
const PASSWORD = 'TestPass123!';
const viewerEmail = `e2e-sa-viewer-${stamp}@machinefacturas.test`;
let tenantAId = '';
let cycleId = '';
let employeeId = '';
let viewerUserId = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
  const password = await bcrypt.hash(PASSWORD, 10);
  const viewer = await prisma.user.create({
    data: {
      name: 'E2E SA Viewer', email: viewerEmail, password,
      tenantId: tenantAId, tenantRole: 'VIEWER', platformRole: 'NONE', emailVerificationRequired: false,
    },
  });
  viewerUserId = viewer.id;
});

afterAll(async () => {
  if (cycleId) await prisma.rhPerformanceCycle.deleteMany({ where: { tenantId: tenantAId, id: cycleId } });
  if (employeeId) await prisma.rhEmployee.deleteMany({ where: { tenantId: tenantAId, id: employeeId } });
  await prisma.user.deleteMany({ where: { tenantId: tenantAId, id: viewerUserId } });
  await prisma.$disconnect();
});

describe('Machine RH — self-assessment', () => {
  it('funcionário submete autoavaliação e gestor vê no ciclo', async () => {
    const admin = await login();
    const employee = await authenticatedFetch('/api/rh/employees', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Self', lastName: `Assess${stamp}`, hireDate: '2026-02-01', baseSalary: 220000, email: viewerEmail }),
    });
    expect(employee.status).toBe(201);
    employeeId = (await employee.json()).id;

    const cycle = await authenticatedFetch('/api/rh/performance/cycles', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E SelfAssess ${stamp}`, startsAt: '2026-07-01', criteria: [{ name: 'Desempenho', weight: 1 }] }),
    });
    expect(cycle.status).toBe(201);
    cycleId = (await cycle.json()).id;

    const viewer = await login(viewerEmail, PASSWORD);
    const submit = await authenticatedFetch('/api/meu-rh/self-assessment', viewer, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId, selfScore: 85, comments: 'Boa produtividade' }),
    });
    const submitBody = await submit.text();
    if (submit.status !== 201) throw new Error(`submit failed: ${submitBody}`);
    const submitted = JSON.parse(submitBody);
    expect(submitted.selfScore).toBe(85);

    const existing = await authenticatedFetch(`/api/meu-rh/self-assessment?cycleId=${cycleId}`, viewer);
    expect(existing.status).toBe(200);
    const existingData = await existing.json();
    expect(existingData.selfScore).toBe(85);
    expect(existingData.comments).toContain('produtividade');
  });
});
