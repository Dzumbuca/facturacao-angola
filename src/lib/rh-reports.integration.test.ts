// Testes de integração dos relatórios RH contra a staging LOCAL.
// REGRA DE SEGURANÇA: só corre quando RH_INTEGRATION_TEST=1 E DATABASE_URL aponta para localhost.
// Nunca apontar para produção/Supabase — esses testes são descartáveis.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHmac, randomInt } from 'node:crypto';
import { getRhReportDataset } from './rh-reports';

const RUN = process.env.RH_INTEGRATION_TEST === '1' && (process.env.DATABASE_URL ?? '').includes('localhost');
const describeLocal = RUN ? describe : describe.skip;

const prisma = new PrismaClient();
const TENANT_A = 'e2e00000-0000-0000-0000-000000000001';
const TENANT_B = 'e2e00000-0000-0000-0000-000000000002';
const PEPPER = process.env.PIN_PEPPER || 'rh-pin-pepper-development-only';
const lookup = (pin: string) => createHmac('sha256', PEPPER).update(pin).digest('hex');
const mkPin = () => String(randomInt(100000, 1000000)).padStart(6, '0');

async function resetRhData() {
  await prisma.rhPayrollRun.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
  await prisma.rhPayrollRuleSet.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] }, name: 'ITEST RuleSet' } });
  await prisma.rhEmployeeDeduction.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
  await prisma.rhLeaveRequest.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
  await prisma.rhTimeEntry.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
  await prisma.rhContract.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } });
  await prisma.rhEmployee.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] }, employeeNumber: { startsWith: 'ITEST-' } } });
  await prisma.rhDepartment.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] }, name: { startsWith: 'ITEST ' } } });
}

async function seed() {
  const deptA1 = await prisma.rhDepartment.create({ data: { tenantId: TENANT_A, name: 'ITEST Engenharia' } });
  const deptA2 = await prisma.rhDepartment.create({ data: { tenantId: TENANT_A, name: 'ITEST Vendas' } });
  const deptB = await prisma.rhDepartment.create({ data: { tenantId: TENANT_B, name: 'ITEST Contabilidade' } });

  const mk = (tenantId: string, deptId: string | null, num: string, firstName: string, lastName: string, salary: number, status = 'ACTIVO') => {
    const pin = mkPin();
    return prisma.rhEmployee.create({
      data: {
        tenantId, departmentId: deptId, employeeNumber: num, firstName, lastName, baseSalary: salary,
        hireDate: new Date('2026-01-10'), status,
        pinHash: bcrypt.hashSync(pin, 10), pinLookup: lookup(pin), pinChangedAt: new Date(),
      },
    });
  };
  await mk(TENANT_A, deptA1.id, 'ITEST-A-001', 'Ana', 'Silva', 200000);
  await mk(TENANT_A, deptA1.id, 'ITEST-A-002', 'Bruno', 'Costa', 180000);
  await mk(TENANT_A, deptA2.id, 'ITEST-A-003', 'Carla', 'Mendes', 150000, 'INACTIVO');
  await mk(TENANT_B, deptB.id, 'ITEST-B-001', 'Daniel', 'Oliveira', 160000);

  const empA1 = await prisma.rhEmployee.findFirst({ where: { tenantId: TENANT_A, employeeNumber: 'ITEST-A-001' } });
  const empA2 = await prisma.rhEmployee.findFirst({ where: { tenantId: TENANT_A, employeeNumber: 'ITEST-A-002' } });
  const empB1 = await prisma.rhEmployee.findFirst({ where: { tenantId: TENANT_B, employeeNumber: 'ITEST-B-001' } });

  await prisma.rhContract.create({ data: { tenantId: TENANT_A, employeeId: empA1!.id, type: 'TERMO_CERTO', status: 'ACTIVO', startDate: new Date('2026-01-15'), endDate: new Date(Date.now() + 15 * 86400000), salary: 200000 } });
  await prisma.rhContract.create({ data: { tenantId: TENANT_A, employeeId: empA2!.id, type: 'INDEFINIDO', status: 'ACTIVO', startDate: new Date('2025-06-01'), salary: 180000 } });
  await prisma.rhContract.create({ data: { tenantId: TENANT_B, employeeId: empB1!.id, type: 'INDEFINIDO', status: 'ACTIVO', startDate: new Date('2026-02-01'), salary: 160000 } });

  await prisma.rhLeaveRequest.create({ data: { tenantId: TENANT_A, employeeId: empA1!.id, type: 'FERIAS', status: 'APROVADO', startDate: new Date(), endDate: new Date(Date.now() + 5 * 86400000), days: 5 } });
  await prisma.rhLeaveRequest.create({ data: { tenantId: TENANT_A, employeeId: empA2!.id, type: 'FERIAS', status: 'PENDENTE', startDate: new Date(Date.now() + 30 * 86400000), endDate: new Date(Date.now() + 33 * 86400000), days: 3 } });
  await prisma.rhLeaveRequest.create({ data: { tenantId: TENANT_A, employeeId: empA2!.id, type: 'LICENCA', status: 'REJEITADO', startDate: new Date(), endDate: new Date(), days: 1 } });

  const now = new Date();
  const base = new Date(now); base.setHours(8, 0, 0, 0); // 08:00 local — mesmo dia
  await prisma.rhTimeEntry.create({ data: { tenantId: TENANT_A, employeeId: empA1!.id, type: 'ENTRADA', occurredAt: base } });
  await prisma.rhTimeEntry.create({ data: { tenantId: TENANT_A, employeeId: empA1!.id, type: 'SAIDA_ALMOCO', occurredAt: new Date(base.getTime() + 4 * 3600000) } }); // 12:00
  await prisma.rhTimeEntry.create({ data: { tenantId: TENANT_A, employeeId: empA1!.id, type: 'SAIDA', occurredAt: new Date(base.getTime() + 8 * 3600000) } }); // 16:00

  const ruleset = await prisma.rhPayrollRuleSet.create({ data: { tenantId: TENANT_A, name: 'ITEST RuleSet', effectiveFrom: new Date('2026-01-01'), legalStatus: 'PENDENTE', config: {} } });
  await prisma.rhPayrollRun.create({ data: { tenantId: TENANT_A, period: '2026-11', rulesetId: ruleset.id, status: 'APROVADO', totalGross: 530000, totalNet: 400000, totalInss: 53000, totalIrt: 77000 } });

  await prisma.rhEmployeeDeduction.create({ data: { tenantId: TENANT_A, employeeId: empA1!.id, description: 'Adiantamento', type: 'ADIANTAMENTO', amount: 50000, remainingInstallments: 2, active: true } });
  await prisma.rhEmployeeDeduction.create({ data: { tenantId: TENANT_A, employeeId: empA2!.id, description: 'Empréstimo concluído', type: 'EMPRESTIMO', amount: 30000, remainingInstallments: 0, active: false } });
}

const year = new Date().getFullYear();
const period = { key: 'thisYear', start: new Date(year, 0, 1), endExclusive: new Date(year + 1, 0, 1), timeZone: 'Africa/Luanda' as const };

describeLocal('Relatórios RH — integração local', () => {
  beforeAll(async () => { await resetRhData(); await seed(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('employees: A contém os 3 ITEST; totais ITEST = 530.000', async () => {
    const rep = await getRhReportDataset(TENANT_A, period, 'employees');
    const itest = rep.rows.filter((r) => String(r[0]).startsWith('ITEST-'));
    expect(itest).toHaveLength(3);
    const sum = itest.reduce((acc, r) => acc + Number(r[5]), 0);
    expect(sum).toBe(530000);
  });

  it('attendance: Ana aparece uma vez com 1 dia', async () => {
    const rep = await getRhReportDataset(TENANT_A, period, 'attendance');
    const ana = rep.rows.find((r) => r[1] === 'Ana Silva');
    expect(ana).toBeTruthy();
    expect(ana![5]).toBe(1);
  });

  it('leaves: filtro APROVADO devolve 1; todos = 3', async () => {
    const aprovado = await getRhReportDataset(TENANT_A, period, 'leaves', null, null, 'APROVADO');
    expect(aprovado.rows).toHaveLength(1);
    const all = await getRhReportDataset(TENANT_A, period, 'leaves');
    expect(all.rows).toHaveLength(3);
  });

  it('payroll: 1 processamento; totals bruto=530.000 e líquido=400.000', async () => {
    const rep = await getRhReportDataset(TENANT_A, period, 'payroll');
    expect(rep.rows).toHaveLength(1);
    expect(Number(rep.totals[3])).toBe(530000);
    expect(Number(rep.totals[4])).toBe(400000);
  });

  it('deductions: activos=1, todos=2, total activos=50.000', async () => {
    const act = await getRhReportDataset(TENANT_A, period, 'deductions', null, null, 'true');
    expect(act.rows).toHaveLength(1);
    expect(Number(act.totals[5])).toBe(50000);
    const all = await getRhReportDataset(TENANT_A, period, 'deductions');
    expect(all.rows).toHaveLength(2);
  });

  it('contracts: 2 em A, destaca 1 a vencer em 30 dias', async () => {
    const rep = await getRhReportDataset(TENANT_A, period, 'contracts');
    expect(rep.rows).toHaveLength(2);
    expect(String(rep.totals[5])).toMatch(/a vencer/i);
  });

  it('isolamento: tenant B não vê dados de A; contém apenas ITEST-B', async () => {
    const empB = await getRhReportDataset(TENANT_B, period, 'employees');
    expect(empB.rows.some((r) => String(r[0]).startsWith('ITEST-A'))).toBe(false);
    expect(empB.rows.some((r) => String(r[0]) === 'ITEST-B-001')).toBe(true);
    const payB = await getRhReportDataset(TENANT_B, period, 'payroll');
    expect(payB.rows.every((r) => String(r[1]) !== 'ITEST RuleSet')).toBe(true);
    const attB = await getRhReportDataset(TENANT_B, period, 'attendance');
    expect(attB.rows.some((r) => String(r[0]).startsWith('ITEST-A'))).toBe(false);
  });

  it('período vazio: assiduidade sem dados devolve 0 rows', async () => {
    const empty = { key: 'empty', start: new Date('2020-01-01'), endExclusive: new Date('2020-02-01'), timeZone: 'Africa/Luanda' as const };
    const rep = await getRhReportDataset(TENANT_A, empty, 'attendance');
    expect(rep.rows).toHaveLength(0);
  });
});
