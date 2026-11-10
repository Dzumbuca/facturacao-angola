import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { calculatePayslip, parsePayrollConfig } from '@/lib/rh-payroll';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhPayrollRun.findMany({
      where: { tenantId: access.tenantId },
      include: { ruleset: { select: { id: true, name: true } }, _count: { select: { payslips: true } } },
      orderBy: { period: 'desc' },
      take: 100,
    }), { userId: access.userId });
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const period = typeof body.period === 'string' ? body.period.trim() : '';
    const rulesetId = typeof body.rulesetId === 'string' ? body.rulesetId : '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: 'Período inválido (AAAA-MM).' }, { status: 400 });
    if (!rulesetId) return NextResponse.json({ error: 'Conjunto de regras obrigatório.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const ruleset = await tx.rhPayrollRuleSet.findFirst({ where: { id: rulesetId, tenantId: access.tenantId, status: 'ACTIVE' } });
      if (!ruleset) return { code: 'RULESET_NOT_FOUND' as const };
      const existing = await tx.rhPayrollRun.findFirst({ where: { tenantId: access.tenantId, period }, select: { id: true } });
      if (existing) return { code: 'PERIOD_EXISTS' as const };

      const parsed = parsePayrollConfig(ruleset.config);
      if ('error' in parsed) return { code: 'BAD_RULESET' as const, error: parsed.error };
      const employees = (await tx.rhEmployee.findMany({
        where: { tenantId: access.tenantId, status: 'ACTIVO' },
        select: { id: true, baseSalary: true },
        orderBy: { employeeNumber: 'asc' },
      })) as any[];
      if (employees.length === 0) return { code: 'NO_EMPLOYEES' as const };

      const payslips = employees.map((employee: any) => {
        const calc = calculatePayslip({ baseSalary: Number(employee.baseSalary), config: parsed.config });
        return { tenantId: access.tenantId, employeeId: employee.id, ...calc, lines: { irtBrackets: parsed.config.irtBrackets.length } };
      });
      const totals = payslips.reduce((acc: any, slip: any) => ({
        gross: acc.gross + slip.gross,
        net: acc.net + slip.net,
        inss: acc.inss + slip.inss,
        irt: acc.irt + slip.irt,
      }), { gross: 0, net: 0, inss: 0, irt: 0 });

      const run = await tx.rhPayrollRun.create({
        data: {
          tenantId: access.tenantId,
          period,
          rulesetId,
          status: 'CALCULADO',
          totalGross: totals.gross,
          totalNet: totals.net,
          totalInss: totals.inss,
          totalIrt: totals.irt,
          createdByUserId: access.userId,
          payslips: { create: payslips },
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_PAYROLL_CALCULATED', entity: 'RhPayrollRun', entityId: run.id, metadata: { period, rulesetId, employees: employees.length } });
      return { code: 'OK' as const, run };
    }, { userId: access.userId });

    if (result.code === 'RULESET_NOT_FOUND') return NextResponse.json({ error: 'Conjunto de regras não encontrado.' }, { status: 404 });
    if (result.code === 'PERIOD_EXISTS') return NextResponse.json({ code: 'PERIOD_EXISTS', error: 'Já existe um processamento para este período.' }, { status: 409 });
    if (result.code === 'BAD_RULESET') return NextResponse.json({ error: (result as any).error ?? 'Regras inválidas.' }, { status: 400 });
    if (result.code === 'NO_EMPLOYEES') return NextResponse.json({ error: 'Não há funcionários activos para processar.' }, { status: 400 });
    return NextResponse.json(result.run, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
