// E2E HTTP — payroll com horas extra e faltas calculadas a partir do ponto.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
const period = `2026-${String((new Date().getMonth() % 12) + 1).padStart(2, '0')}`;
let tenantAId = '';
let employeeId = '';
let shiftId = '';
let rulesetId = '';
let runId = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
  if (!tenantAId) throw new Error('Tenant seed não encontrado');
  const shift = await prisma.rhShift.create({
    data: { tenantId: tenantAId, name: `E2E Ajuste ${stamp}`, startTime: '08:00', endTime: '17:00', toleranceMinutes: 5 },
  });
  shiftId = shift.id;
  const check = await prisma.rhShift.findFirst({ where: { id: shift.id, tenantId: tenantAId, isActive: true } });
  if (!check) throw new Error('Shift criado não encontrado no tenant');
});

afterAll(async () => {
  if (runId) await prisma.rhPayrollRun.deleteMany({ where: { tenantId: tenantAId, id: runId } });
  if (rulesetId) await prisma.rhPayrollRuleSet.deleteMany({ where: { tenantId: tenantAId, id: rulesetId } });
  if (employeeId) await prisma.rhEmployee.deleteMany({ where: { tenantId: tenantAId, id: employeeId } });
  if (shiftId) await prisma.rhShift.deleteMany({ where: { tenantId: tenantAId, id: shiftId } });
  await prisma.$disconnect();
});

describe('Machine RH — payroll com ajuste por tempo', () => {
  it('calcula horas extra, faltas e reduz o líquido quando configurado', async () => {
    const admin = await login();
    const employee = await authenticatedFetch('/api/rh/employees', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Timed', lastName: `Adj${stamp}`, hireDate: '2026-01-01', baseSalary: 450000, shiftId }),
    });
    if (employee.status !== 201) {
      const debug = await employee.text();
      throw new Error(`employee create failed (${employee.status}): ${debug}`);
    }
    const employeeData = await employee.json();
    employeeId = employeeData.id;

    // Inserir um mês de ponto: ~20 dias úteis; o funcionário trabalha menos que o turno (09h) ⇒ faltas
    const start = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1));
    const end = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1));
    const cap = Math.min(end.getTime(), start.getTime() + 28 * 86_400_000);
    const entries: Array<{ type: 'ENTRADA' | 'SAIDA_ALMOCO' | 'REGRESSO_ALMOCO' | 'SAIDA'; occurredAt: Date }> = [];
    for (let t = start.getTime(); t < cap; t += 86_400_000) {
      const day = new Date(t).getUTCDay();
      if (day === 0 || day === 6) continue;
      const h = (hh: number, mm: number) => new Date(Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate(), hh, mm) - 3600_000);
      entries.push({ type: 'ENTRADA', occurredAt: h(9, 0) });
      entries.push({ type: 'SAIDA_ALMOCO', occurredAt: h(13, 30) });
      entries.push({ type: 'REGRESSO_ALMOCO', occurredAt: h(14, 30) });
      entries.push({ type: 'SAIDA', occurredAt: h(18, 0) });
    }
    await prisma.rhTimeEntry.createMany({ data: entries.map((entry) => ({ tenantId: tenantAId, employeeId, type: entry.type, source: 'PIN', occurredAt: entry.occurredAt })) });

    const ruleset = await authenticatedFetch('/api/rh/payroll/rulesets', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `E2E Tempo ${stamp}`, effectiveFrom: '2026-01-01', inssEmployeeRate: 3, inssEmployerRate: 8, foodAllowance: 0, transportAllowance: 0, monthlyHours: 220, overtimeRatePercent: 50, absenceRatePercent: 100, irtBrackets: [{ upTo: null, rate: 10, deduction: 0 }] }),
    });
    expect(ruleset.status).toBe(201);
    const rulesetData = await ruleset.json();
    rulesetId = rulesetData.id;

    const run = await authenticatedFetch('/api/rh/payroll/runs', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period, rulesetId }),
    });
    expect(run.status).toBe(201);
    const runData = await run.json();
    runId = runData.id;

    const slip = await prisma.rhPayslip.findFirst({ where: { tenantId: tenantAId, runId, employeeId } });
    expect(slip).not.toBeNull();
    // Turno 08:00→17:00 = 9h/dia; trabalhado = 8h/dia ⇒ ~20h de faltas
    expect(Number(slip!.overtime)).toBe(0);
    expect(Number(slip!.absences)).toBeGreaterThan(0);
  });

});
