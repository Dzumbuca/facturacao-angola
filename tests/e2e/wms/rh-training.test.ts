// E2E HTTP — formação profissional.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
let tenantAId = '';
let employeeId = '';
let courseId = '';
let enrollmentId = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
});

afterAll(async () => {
  if (enrollmentId) await prisma.rhTrainingEnrollment.deleteMany({ where: { tenantId: tenantAId, id: enrollmentId } });
  if (courseId) await prisma.rhTrainingCourse.deleteMany({ where: { tenantId: tenantAId, id: courseId } });
  if (employeeId) await prisma.rhEmployee.deleteMany({ where: { tenantId: tenantAId, id: employeeId } });
  await prisma.$disconnect();
});

describe('Machine RH — formação profissional', () => {
  it('cria curso, inscreve, conclui com pontuação e valida', async () => {
    const admin = await login();
    const employee = await authenticatedFetch('/api/rh/employees', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Formacao', lastName: `E2E${stamp}`, hireDate: '2026-02-01', baseSalary: 180000 }),
    });
    expect(employee.status).toBe(201);
    const employeeData = await employee.json();
    employeeId = employeeData.id;

    const course = await authenticatedFetch('/api/rh/training/courses', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `E2E Segurança ${stamp}`, startDate: '2026-06-01', cargaHoras: 16, trainerName: 'Formador E2E' }),
    });
    expect(course.status).toBe(201);
    const courseData = await course.json();
    courseId = courseData.id;
    expect(courseData.cargaHoras).toBe(16);

    const enroll = await authenticatedFetch('/api/rh/training/enrollments', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, employeeId }),
    });
    expect(enroll.status).toBe(201);
    const enrollment = await enroll.json();
    enrollmentId = enrollment.id;

    const duplicate = await authenticatedFetch('/api/rh/training/enrollments', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, employeeId }),
    });
    expect(duplicate.status).toBe(409);

    const complete = await authenticatedFetch(`/api/rh/training/enrollments/${enrollmentId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONCLUIDA', score: 92 }),
    });
    expect(complete.status).toBe(200);

    const badScore = await authenticatedFetch(`/api/rh/training/enrollments/${enrollmentId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONCLUIDA', score: 101 }),
    });
    expect(badScore.status).toBe(400);

    const close = await authenticatedFetch('/api/rh/training/courses', admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: courseId, status: 'CONCLUIDO' }),
    });
    expect(close.status).toBe(200);
  });

  it('isolamento por empresa', async () => {
    const sessionB = await login('e2e-other@machinefacturas.test');
    const foreign = await authenticatedFetch(`/api/rh/training/courses`, sessionB);
    expect(foreign.status).toBe(200);
    const foreignData = await foreign.json();
    expect(foreignData.some((item: any) => item.id === courseId)).toBe(false);
  });
});
