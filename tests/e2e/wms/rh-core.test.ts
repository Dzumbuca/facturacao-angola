// E2E HTTP do núcleo Machine RH: gate, RBAC, multi-tenant, CRUD e PWA.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
const PASSWORD = 'TestPass123!';

function luandaHm(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Luanda', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  return `${parts.find((p) => p.type === 'hour')?.value}:${parts.find((p) => p.type === 'minute')?.value}`;
}
const viewerEmail = `e2e-rh-viewer-${stamp}@machinefacturas.test`;
const blockedEmail = `e2e-rh-blocked-${stamp}@machinefacturas.test`;
let tenantAId = '';
let blockedTenantId = '';
let viewerId = '';
let blockedUserId = '';
let departmentId = '';
let employeeId = '';
let employeeNumber = '';
let shiftId = '';
let deviceId = '';
let documentId = '';
let document2Id = '';
let documentTemplateId = '';
let payrollRunId = '';
let payrollRulesetId = '';
let rhMemberId = '';
let memberPayrollRulesetId = '';
let paymentBatchId = '';

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
  if (shiftId) await prisma.rhShift.deleteMany({ where: { tenantId: tenantAId, id: shiftId } });
  if (deviceId) await prisma.rhDevice.deleteMany({ where: { tenantId: tenantAId, id: deviceId } });
  if (documentId) await prisma.rhDocument.deleteMany({ where: { tenantId: tenantAId, id: documentId } });
  if (document2Id) await prisma.rhDocument.deleteMany({ where: { tenantId: tenantAId, id: document2Id } });
  if (documentTemplateId) await prisma.rhDocumentTemplate.deleteMany({ where: { tenantId: tenantAId, id: documentTemplateId } });
  if (paymentBatchId) await prisma.rhPaymentBatch.deleteMany({ where: { tenantId: tenantAId, id: paymentBatchId } });
  if (payrollRunId) await prisma.rhPayrollRun.deleteMany({ where: { tenantId: tenantAId, id: payrollRunId } });
  if (payrollRulesetId) await prisma.rhPayrollRuleSet.deleteMany({ where: { tenantId: tenantAId, id: payrollRulesetId } });
  if (memberPayrollRulesetId) await prisma.rhPayrollRuleSet.deleteMany({ where: { tenantId: tenantAId, id: memberPayrollRulesetId } });
  if (rhMemberId) await prisma.rhMember.deleteMany({ where: { tenantId: tenantAId, id: rhMemberId } });
  await prisma.rhLeaveRequest.deleteMany({ where: { tenantId: tenantAId } });
  await prisma.rhSettings.deleteMany({ where: { tenantId: tenantAId } });
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

    const nowLuanda = luandaHm(new Date());
    const candidate = luandaHm(new Date(Date.now() - 30 * 60_000));
    const startTime = candidate > nowLuanda ? '00:00' : candidate;
    const shift = await authenticatedFetch('/api/rh/shifts', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Horário ${stamp}`, startTime, endTime: '23:59', toleranceMinutes: 0 }),
    });
    expect(shift.status).toBe(201);
    shiftId = (await shift.json()).id;

    const employee = await authenticatedFetch('/api/rh/employees', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'E2E', lastName: `RH ${stamp}`, employeeNumber: 'ignorado', departmentId,
        hireDate: '2026-01-15', contractType: 'INDEFINIDO', baseSalary: 350000, shiftId,
        bi: '000000000LA000', email: `e2e-rh-${stamp}@machinefacturas.test`, pin: '1234',
      }),
    });
    expect(employee.status).toBe(201);
    const employeeData = await employee.json();
    employeeId = employeeData.id;
    employeeNumber = employeeData.employeeNumber;
    expect(employeeNumber).toMatch(/^RH-\d{4}$/);
    expect(Number(employeeData.baseSalary)).toBe(350000);
    expect(employeeData.pinHash).toBeUndefined();
    expect(employeeData.hasPin).toBe(true);

    const contract = await authenticatedFetch('/api/rh/contracts', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'TERMO_CERTO', status: 'ACTIVO', startDate: '2026-01-15', endDate: '2026-12-31', salary: 350000 }),
    });
    expect(contract.status).toBe(201);
    expect((await contract.json()).employeeId).toBe(employeeId);

    // Machine Point: QR assinado, marcação e rejeições.
    const qr = await authenticatedFetch(`/api/rh/employees/${employeeId}/qr`, session);
    expect(qr.status).toBe(200);
    const qrData = await qr.json();
    expect(qrData.token).toContain('.');
    expect(String(qrData.svg)).toContain('<svg');

    const invalidQr = await authenticatedFetch('/api/rh/attendance/qr', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalido', type: 'SAIDA_ALMOCO' }),
    });
    expect(invalidQr.status).toBe(401);

    const qrClock = await authenticatedFetch('/api/rh/attendance/qr', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrData.token, type: 'SAIDA_ALMOCO' }),
    });
    expect(qrClock.status).toBe(201);
    expect((await qrClock.json()).source).toBe('QR');

    const qrDuplicate = await authenticatedFetch('/api/rh/attendance/qr', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrData.token, type: 'SAIDA_ALMOCO' }),
    });
    expect(qrDuplicate.status).toBe(409);

    const device = await authenticatedFetch('/api/rh/devices', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Terminal ${stamp}` }),
    });
    expect(device.status).toBe(201);
    const deviceData = await device.json();
    deviceId = deviceData.id;
    expect(deviceData.token).toBeTruthy();

    const devices = await authenticatedFetch('/api/rh/devices', session);
    expect(devices.status).toBe(200);
    const devicesData = await devices.json();
    expect(devicesData.some((d: any) => d.id === deviceId && d.token === undefined && d.tokenHash === undefined)).toBe(true);

    const qrWithDevice = await authenticatedFetch('/api/rh/attendance/qr', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrData.token, type: 'REGRESSO_ALMOCO', deviceToken: deviceData.token }),
    });
    expect(qrWithDevice.status).toBe(201);
    expect((await qrWithDevice.json()).deviceId).toBe(deviceId);

    const invalidDevice = await authenticatedFetch('/api/rh/attendance/qr', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrData.token, type: 'SAIDA', deviceToken: 'invalido' }),
    });
    expect(invalidDevice.status).toBe(401);

    const sessionQrB = await login('e2e-other@machinefacturas.test');
    const foreignQr = await authenticatedFetch('/api/rh/attendance/qr', sessionQrB, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrData.token, type: 'ENTRADA' }),
    });
    expect(foreignQr.status).toBe(403);

    const foreignDevice = await authenticatedFetch('/api/rh/attendance/qr', sessionQrB, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrData.token, type: 'ENTRADA', deviceToken: deviceData.token }),
    });
    expect(foreignDevice.status).toBe(403);

    // Machine Point: PIN errado, entrada, duplicado no último minuto.
    const wrongPin = await authenticatedFetch('/api/rh/attendance/clock', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'ENTRADA', pin: '9999' }),
    });
    expect(wrongPin.status).toBe(401);

    const clock = await authenticatedFetch('/api/rh/attendance/clock', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'ENTRADA', pin: '1234' }),
    });
    expect(clock.status).toBe(201);
    const clockData = await clock.json();
    expect(clockData.type).toBe('ENTRADA');
    expect(clockData.source).toBe('PIN');

    const duplicate = await authenticatedFetch('/api/rh/attendance/clock', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'ENTRADA', pin: '1234' }),
    });
    expect(duplicate.status).toBe(409);

    const attendance = await authenticatedFetch('/api/rh/attendance', session);
    expect(attendance.status).toBe(200);
    const attendanceData = await attendance.json();
    const todayEntry = attendanceData.find((entry: any) => entry.id === clockData.id);
    expect(todayEntry?.employee.id).toBe(employeeId);
    expect(todayEntry?.lateMinutes).toBeGreaterThan(0);

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

    const clockB = await authenticatedFetch('/api/rh/attendance/clock', sessionB, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'ENTRADA', pin: '1234' }),
    });
    expect(clockB.status).toBe(404);

    const employeeWithForeignShift = await authenticatedFetch('/api/rh/employees', sessionB, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'E2E', lastName: 'Cross', hireDate: '2026-01-15', baseSalary: 1000, shiftId }),
    });
    expect(employeeWithForeignShift.status).toBe(400);
  });

  it('férias: cria, bloqueia sobreposição, aprova e configura saldo', async () => {
    const session = await login();
    const leave = await authenticatedFetch('/api/rh/leaves', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'FERIAS', startDate: '2026-03-02', endDate: '2026-03-06', reason: 'E2E férias' }),
    });
    expect(leave.status).toBe(201);
    const leaveData = await leave.json();
    expect(leaveData.days).toBe(5);
    expect(leaveData.status).toBe('PENDENTE');

    const overlap = await authenticatedFetch('/api/rh/leaves', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, type: 'FERIAS', startDate: '2026-03-05', endDate: '2026-03-10' }),
    });
    expect(overlap.status).toBe(409);

    const approve = await authenticatedFetch(`/api/rh/leaves/${leaveData.id}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'APROVADO' }),
    });
    expect(approve.status).toBe(200);
    expect((await approve.json()).status).toBe('APROVADO');

    const again = await authenticatedFetch(`/api/rh/leaves/${leaveData.id}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REJEITADO' }),
    });
    expect(again.status).toBe(409);

    const settings = await authenticatedFetch('/api/rh/settings', session, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vacationDaysPerYear: 22 }),
    });
    expect(settings.status).toBe(200);

    const list = await authenticatedFetch('/api/rh/leaves?year=2026', session);
    expect(list.status).toBe(200);
    const listData = await list.json();
    expect(listData.vacationDaysPerYear).toBe(22);
    expect(listData.items.some((item: any) => item.id === leaveData.id && item.status === 'APROVADO')).toBe(true);

    const sessionB = await login('e2e-other@machinefacturas.test');
    const crossTenant = await authenticatedFetch(`/api/rh/leaves/${leaveData.id}`, sessionB, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'APROVADO' }),
    });
    expect(crossTenant.status).toBe(404);
  });

  it('documentos: modelo, variáveis, PDF, emissão e cross-tenant', async () => {
    const session = await login();
    const template = await authenticatedFetch('/api/rh/document-templates', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Modelo ${stamp}`, type: 'DECLARACAO_TRABALHO', body: 'A empresa {{empresa_nome}} declara que {{funcionario_nome}} (BI {{funcionario_bi}}) exerce {{cargo}}.' }),
    });
    expect(template.status).toBe(201);
    documentTemplateId = (await template.json()).id;

    const created = await authenticatedFetch('/api/rh/documents', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: documentTemplateId, employeeId, title: 'Declaração E2E' }),
    });
    expect(created.status).toBe(201);
    const document = await created.json();
    documentId = document.id;
    expect(document.status).toBe('RASCUNHO');
    expect(document.content).toContain('E2E');
    expect(document.content).not.toContain('{{funcionario_nome}}');

    const pdf = await authenticatedFetch(`/api/rh/documents/${documentId}/pdf`, session);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    const header = Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString('utf8');
    expect(header).toBe('%PDF');

    const docx = await authenticatedFetch(`/api/rh/documents/${documentId}/docx`, session);
    expect(docx.status).toBe(200);
    expect(docx.headers.get('content-type')).toContain('wordprocessingml');
    const docxHeader = Buffer.from(await docx.arrayBuffer()).subarray(0, 2).toString('utf8');
    expect(docxHeader).toBe('PK');

    const issue = await authenticatedFetch(`/api/rh/documents/${documentId}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'EMITIDO' }),
    });
    expect(issue.status).toBe(200);
    const issued = await issue.json();
    expect(issued.status).toBe('EMITIDO');
    expect(String(issued.hash)).toHaveLength(64);

    const again = await authenticatedFetch(`/api/rh/documents/${documentId}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ANULADO' }),
    });
    expect(again.status).toBe(409);

    const updatedTemplate = await authenticatedFetch(`/api/rh/document-templates/${documentTemplateId}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Versão 2: {{funcionario_nome}} na empresa {{empresa_nome}}.' }),
    });
    expect(updatedTemplate.status).toBe(200);
    expect((await updatedTemplate.json()).version).toBe(2);

    const versions = await authenticatedFetch(`/api/rh/document-templates/${documentTemplateId}/versions`, session);
    expect(versions.status).toBe(200);
    expect((await versions.json()).length).toBe(2);

    const doc2 = await authenticatedFetch('/api/rh/documents', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: documentTemplateId, employeeId }),
    });
    expect(doc2.status).toBe(201);
    const doc2Data = await doc2.json();
    document2Id = doc2Data.id;
    expect(doc2Data.templateVersion).toBe(2);
    expect(doc2Data.content).toContain('Versão 2');

    const sessionB = await login('e2e-other@machinefacturas.test');
    const foreignPdf = await authenticatedFetch(`/api/rh/documents/${documentId}/pdf`, sessionB);
    expect(foreignPdf.status).toBe(404);
    const foreignTemplate = await authenticatedFetch(`/api/rh/document-templates/${documentTemplateId}`, sessionB, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Hack' }),
    });
    expect(foreignTemplate.status).toBe(404);
  });

  it('payroll: regras configuráveis, cálculo, duplicado e transições', async () => {
    const session = await login();
    const ruleset = await authenticatedFetch('/api/rh/payroll/rulesets', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `E2E Regras ${stamp}`, effectiveFrom: '2026-01-01',
        inssEmployeeRate: 3, inssEmployerRate: 8, foodAllowance: 0, transportAllowance: 0,
        irtBrackets: [{ upTo: 100000, rate: 0, deduction: 0 }, { upTo: null, rate: 10, deduction: 0 }],
      }),
    });
    expect(ruleset.status).toBe(201);
    payrollRulesetId = (await ruleset.json()).id;

    const run = await authenticatedFetch('/api/rh/payroll/runs', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: '2026-01', rulesetId: payrollRulesetId }),
    });
    const runText = await run.text();
    expect(run.status, runText).toBe(201);
    const runData = JSON.parse(runText);
    payrollRunId = runData.id;
    expect(runData.status).toBe('CALCULADO');
    expect(Number(runData.totalGross)).toBe(350000);
    expect(Number(runData.totalInss)).toBe(10500);
    expect(Number(runData.totalIrt)).toBe(33950);
    expect(Number(runData.totalNet)).toBe(305550);

    const duplicate = await authenticatedFetch('/api/rh/payroll/runs', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: '2026-01', rulesetId: payrollRulesetId }),
    });
    expect(duplicate.status).toBe(409);

    const detail = await authenticatedFetch(`/api/rh/payroll/runs/${payrollRunId}`, session);
    expect(detail.status).toBe(200);
    const detailData = await detail.json();
    expect(detailData.payslips.length).toBe(1);
    expect(detailData.payslips[0].employee.id).toBe(employeeId);
    expect(Number(detailData.payslips[0].net)).toBe(305550);

    const approve = await authenticatedFetch(`/api/rh/payroll/runs/${payrollRunId}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'APROVADO' }),
    });
    expect(approve.status).toBe(200);
    expect((await approve.json()).status).toBe('APROVADO');

    const pay = await authenticatedFetch(`/api/rh/payroll/runs/${payrollRunId}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PAGO' }),
    });
    expect(pay.status).toBe(409);

    const batch = await authenticatedFetch('/api/rh/payments', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: payrollRunId }),
    });
    expect(batch.status).toBe(201);
    const batchData = await batch.json();
    paymentBatchId = batchData.id;
    expect(Number(batchData.total)).toBe(305550);

    const batchDuplicate = await authenticatedFetch('/api/rh/payments', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: payrollRunId }),
    });
    expect(batchDuplicate.status).toBe(409);

    const send = await authenticatedFetch(`/api/rh/payments/${paymentBatchId}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'SENT' }),
    });
    expect(send.status).toBe(200);
    const confirm = await authenticatedFetch(`/api/rh/payments/${paymentBatchId}`, session, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    expect(confirm.status).toBe(200);

    const settled = await authenticatedFetch(`/api/rh/payroll/runs/${payrollRunId}`, session);
    expect((await settled.json()).status).toBe('PAGO');

    const foreignBatch = await authenticatedFetch(`/api/rh/payments/${paymentBatchId}`, await login('e2e-other@machinefacturas.test'));
    expect(foreignBatch.status).toBe(404);

    const sessionB = await login('e2e-other@machinefacturas.test');
    const foreign = await authenticatedFetch(`/api/rh/payroll/runs/${payrollRunId}`, sessionB);
    expect(foreign.status).toBe(404);
  });

  it('RBAC fino: gestor escreve pessoas, financeiro escreve payroll', async () => {
    const admin = await login();
    const add = await authenticatedFetch('/api/rh/members', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: viewerEmail, role: 'MANAGER' }),
    });
    expect(add.status).toBe(201);
    rhMemberId = (await add.json()).id;

    const manager = await login(viewerEmail, PASSWORD);
    const dashboard = await authenticatedFetch('/rh/dashboard', manager);
    expect(dashboard.status).toBe(200);

    const managerEmployee = await authenticatedFetch('/api/rh/employees', manager, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(managerEmployee.status).toBe(400);

    const managerPayroll = await authenticatedFetch('/api/rh/payroll/rulesets', manager, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Bloqueado ${stamp}` }),
    });
    expect(managerPayroll.status).toBe(403);

    const promote = await authenticatedFetch(`/api/rh/members/${rhMemberId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'FINANCE' }),
    });
    expect(promote.status).toBe(200);

    const finance = await login(viewerEmail, PASSWORD);
    const financeEmployee = await authenticatedFetch('/api/rh/employees', finance, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(financeEmployee.status).toBe(403);

    const financeRuleset = await authenticatedFetch('/api/rh/payroll/rulesets', finance, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `E2E Financeiro ${stamp}`, effectiveFrom: '2026-01-01',
        inssEmployeeRate: 3, inssEmployerRate: 8, foodAllowance: 0, transportAllowance: 0,
        irtBrackets: [{ upTo: null, rate: 0, deduction: 0 }],
      }),
    });
    expect(financeRuleset.status).toBe(201);
    memberPayrollRulesetId = (await financeRuleset.json()).id;
  });

  it('self-service: funcionário vê apenas os próprios dados', async () => {
    const admin = await login();
    const link = await authenticatedFetch(`/api/rh/employees/${employeeId}`, admin, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: viewerEmail }),
    });
    expect(link.status).toBe(200);

    const viewer = await login(viewerEmail, PASSWORD);
    const page = await authenticatedFetch('/meu-rh', viewer);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('E2E');
    expect(html).toContain('Recibos');

    const pdf = await authenticatedFetch(`/api/meu-rh/documents/${documentId}/pdf`, viewer);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');

    const adminPage = await authenticatedFetch('/meu-rh', admin);
    expect(adminPage.status).toBe(200);
    expect(await adminPage.text()).toContain('não está ligado');

    const foreignPdf = await authenticatedFetch(`/api/meu-rh/documents/${documentId}/pdf`, admin);
    expect(foreignPdf.status).toBe(404);
  });

  it('IA: sem chave configurada devolve erro claro, sem chamar modelo', async () => {
    if (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY) return;
    const session = await login();
    const response = await authenticatedFetch('/api/rh/ai/draft', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: 'Rascunho de teste', context: 'Empresa E2E' }),
    });
    if (response.status === 200) return; // chave configurada localmente/Vercel
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('AI_NOT_CONFIGURED');
  });
});
