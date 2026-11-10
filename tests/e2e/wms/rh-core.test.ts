// E2E HTTP do núcleo Machine RH: gate, RBAC, multi-tenant, CRUD e PWA.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
const PASSWORD = 'TestPass123!';
const viewerEmail = `e2e-rh-viewer-${stamp}@machinefacturas.test`;
const blockedEmail = `e2e-rh-blocked-${stamp}@machinefacturas.test`;
let tenantAId = '';
let blockedTenantId = '';
let viewerId = '';
let blockedUserId = '';
let departmentId = '';
let employeeId = '';
let employeeNumber = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
  const hash = await bcrypt.hash(PASSWORD, 10);

  const viewer = await prisma.user.create({
    data: {
      name: 'E2E RH Viewer', email: viewerEmail, password: hash, tenantId: tenantAId,
      tenantRole: 'VIEWER', platformRole: 'NONE', emailVerificationRequired: false,
    },
  });
  viewerId = viewer.id;

  const tenant = await prisma.tenant.create({ data: { name: `E2E RH Bloqueado ${stamp}`, nif: null, plan: 'FREE', status: 'ACTIVE' } });
  blockedTenantId = tenant.id;
  const blockedUser = await prisma.user.create({
    data: {
      name: 'E2E RH Bloqueado', email: blockedEmail, password: hash, tenantId: tenant.id,
      tenantRole: 'COMPANY_ADMIN', platformRole: 'NONE', emailVerificationRequired: false,
    },
  });
  blockedUserId = blockedUser.id;
});

afterAll(async () => {
  if (employeeId) await prisma.rhContract.deleteMany({ where: { tenantId: tenantAId, employeeId } });
  if (employeeId) await prisma.rhEmployee.deleteMany({ where: { tenantId: tenantAId, id: employeeId } });
  if (departmentId) await prisma.rhDepartment.deleteMany({ where: { tenantId: tenantAId, id: departmentId } });
  await prisma.rhAuditLog.deleteMany({ where: { tenantId: tenantAId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (viewerId) await prisma.user.deleteMany({ where: { id: viewerId } });
  if (blockedUserId) await prisma.user.deleteMany({ where: { id: blockedUserId } });
  if (blockedTenantId) await prisma.tenant.deleteMany({ where: { id: blockedTenantId } });
  await prisma.$disconnect();
});

describe('Machine RH - PWA', () => {
  it('manifest próprio com scope /rh e nome Machine RH', async () => {
    const res = await fetch(`${process.env.APP_URL || 'http://localhost:3002'}/rh-manifest.json`);
    expect(res.status).toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toBe('Machine RH');
    expect(manifest.scope).toBe('/rh/');
    expect(manifest.start_url).toBe('/rh/dashboard');
  });
});

describe('Machine RH - gate e RBAC', () => {
  it('empresa sem módulo RH: página redirecciona e API devolve 403', async () => {
    const session = await login(blockedEmail, PASSWORD);
    const page = await authenticatedFetch('/rh/dashboard', session, { redirect: 'manual' });
    expect([307, 308]).toContain(page.status);
    expect(page.headers.get('location') || '').toContain('/apps?rh=bloqueado');
    const api = await authenticatedFetch('/api/rh/employees', session);
    expect(api.status).toBe(403);
  });

  it('perfil VIEWER não acede ao núcleo RH', async () => {
    const session = await login(viewerEmail, PASSWORD);
    const api = await authenticatedFetch('/api/rh/employees', session);
    expect(api.status).toBe(403);
    const page = await authenticatedFetch('/rh/dashboard', session, { redirect: 'manual' });
    expect([307, 308]).toContain(page.status);
    expect(page.headers.get('location') || '').toContain('/apps?rh=sem-permissao');
  });
});

describe('Machine RH - núcleo e isolamento entre empresas', () => {
  it('cria departamento, funcionário e contrato; lista e isola por empresa', async () => {
    const session = await login();

    const dept = await authenticatedFetch('/api/rh/departments', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E RH Dept ${stamp}`, code: 'E2E-RH' }),
    });
    expect(dept.status).toBe(201);
    departmentId = (await dept.json()).id;

    const employee = await authenticatedFetch('/api/rh/employees', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'E2E', lastName: `RH ${stamp}`, employeeNumber: 'ignorado', departmentId,
        hireDate: '2026-01-15', contractType: 'INDEFINIDO', baseSalary: 350000,
        bi: '000000000LA000', email: `e2e-rh-${stamp}@machinefacturas.test`,
      }),
    });
    expect(employee.status).toBe(201);
    const employeeData = await employee.json();
    employeeId = employeeData.id;
    employeeNumber = employeeData.employeeNumber;
    expect(employeeNumber).toMatch(/^RH-\d{4}$/);
    expect(Number(employeeData.baseSalary)).toBe(350000);

    const contract = await authenticatedFetch('/api/rh/contracts', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'TERMO_CERTO', status: 'ACTIVO', startDate: '2026-01-15', endDate: '2026-12-31', salary: 350000 }),
    });
    expect(contract.status).toBe(201);
    expect((await contract.json()).employeeId).toBe(employeeId);

    const list = await authenticatedFetch('/api/rh/employees', session);
    expect(list.status).toBe(200);
    const listData = await list.json();
    expect(listData.some((e: any) => e.id === employeeId)).toBe(true);

    // Tenant B não vê nem altera dados do tenant A.
    const sessionB = await login('e2e-other@machinefacturas.test');
    const listB = await authenticatedFetch('/api/rh/employees', sessionB);
    expect(listB.status).toBe(200);
    expect((await listB.json()).some((e: any) => e.id === employeeId)).toBe(false);
    const patchB = await authenticatedFetch(`/api/rh/employees/${employeeId}`, sessionB, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'Hack' }),
    });
    expect(patchB.status).toBe(404);
  });
});
