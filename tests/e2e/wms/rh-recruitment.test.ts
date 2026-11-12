// E2E HTTP — Recrutamento e seleção.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
let tenantAId = '';
let openingId = '';
let candidateId = '';
let employeeNumber = '';
let employeeId = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
});

afterAll(async () => {
  if (employeeId) await prisma.rhEmployee.deleteMany({ where: { tenantId: tenantAId, id: employeeId } });
  if (candidateId) await prisma.rhCandidate.deleteMany({ where: { tenantId: tenantAId, id: candidateId } });
  if (openingId) await prisma.rhJobOpening.deleteMany({ where: { tenantId: tenantAId, id: openingId } });
  await prisma.$disconnect();
});

describe('Machine RH — recrutamento e seleção', () => {
  it('cria vaga, regista candidato e avança as etapas', async () => {
    const admin = await login();
    const opening = await authenticatedFetch('/api/rh/recruitment/openings', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `E2E Dev ${stamp}`, openings: 2 }),
    });
    expect(opening.status).toBe(201);
    const openingData = await opening.json();
    openingId = openingData.id;

    const candidate = await authenticatedFetch('/api/rh/recruitment/candidates', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobOpeningId: openingId, firstName: 'E2E', lastName: `Cand${stamp}`, email: `e2e-rec-${stamp}@machinefacturas.test` }),
    });
    expect(candidate.status).toBe(201);
    const candidateData = await candidate.json();
    candidateId = candidateData.id;
    expect(candidateData.status).toBe('RECEBIDA');

    for (const stage of ['TRIAGEM', 'ENTREVISTA', 'AVALIACAO', 'APROVADO']) {
      const moved = await authenticatedFetch(`/api/rh/recruitment/candidates/${candidateId}`, admin, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: stage }),
      });
      expect(moved.status).toBe(200);
    }

    const invalid = await authenticatedFetch(`/api/rh/recruitment/candidates/${candidateId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RECEBIDA' }),
    });
    expect(invalid.status).toBe(409);
  });

  it('admite o candidato aprovado como funcionário', async () => {
    const admin = await login();
    const admitted = await authenticatedFetch(`/api/rh/recruitment/candidates/${candidateId}/admit`, admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseSalary: 250000 }),
    });
    expect(admitted.status).toBe(201);
    const admittedData = await admitted.json();
    employeeId = admittedData.employeeId;
    employeeNumber = admittedData.employeeNumber;
    expect(employeeNumber).toMatch(/^RH-/);

    const employee = await prisma.rhEmployee.findUnique({ where: { id: employeeId }, select: { status: true, email: true } });
    expect(employee?.status).toBe('ACTIVO');
    expect(employee?.email).toContain(`e2e-rec-${stamp}`);

    const reAdmit = await authenticatedFetch(`/api/rh/recruitment/candidates/${candidateId}/admit`, admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(reAdmit.status).toBe(409);
  });

  it('isolamento por empresa: vaga e candidato de outro tenant 404', async () => {
    const sessionB = await login('e2e-other@machinefacturas.test');
    const foreign = await authenticatedFetch(`/api/rh/recruitment/candidates/${candidateId}`, sessionB, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'TRIAGEM' }),
    });
    expect(foreign.status).toBe(404);
    const admitForeign = await authenticatedFetch(`/api/rh/recruitment/candidates/${candidateId}/admit`, sessionB, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(admitForeign.status).toBe(404);
  });
});
