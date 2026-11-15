import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { calculatePayslip, parsePayrollConfig, computeTimeAdjustments, buildRuleSnapshot, type TimeEntryLike } from '@/lib/rh-payroll';

const REGRAS_NAO_VALIDADAS = {
  code: 'REGRAS_SALARIAIS_NAO_VALIDADAS' as const,
  error: 'Este processamento não pode ser executado porque existem regras salariais pendentes de validação legal. Apresente a documentação necessária e solicite a validação.',
};

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhPayrollRun.findMany({
      where: { tenantId: access.tenantId },
      include: { ruleset: { select: { id: true, name: true, legalStatus: true } }, _count: { select: { payslips: true } } },
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
    const access = await requireRhAccess('payroll:write');
    const body = await req.json().catch(() => ({}));
    const period = typeof body.period === 'string' ? body.period.trim() : '';
    const rulesetId = typeof body.rulesetId === 'string' ? body.rulesetId : '';
    const mode = body.mode === 'SIMULACAO' ? 'SIMULACAO' : 'OFICIAL';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: 'Período inválido (AAAA-MM).' }, { status: 400 });
    if (!rulesetId) return NextResponse.json({ error: 'Conjunto de regras obrigatório.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const ruleset = await tx.rhPayrollRuleSet.findFirst({
        where: { id: rulesetId, tenantId: access.tenantId, status: 'ACTIVE' },
        select: { id: true, name: true, legalStatus: true, legalDocumentUrl: true, config: true },
      });
      if (!ruleset) return { code: 'RULESET_NOT_FOUND' as const };

      // Bloqueio duro: processamento oficial exige validação legal.
      const legalStatus = (ruleset as any).legalStatus ?? 'PENDENTE';
      if (mode === 'OFICIAL' && legalStatus !== 'VALIDADO') {
        return { code: 'REGRAS_SALARIAIS_NAO_VALIDADAS' as const };
      }

      // Período existente apenas para processamento oficial.
      if (mode === 'OFICIAL') {
        const existing = await tx.rhPayrollRun.findFirst({ where: { tenantId: access.tenantId, period }, select: { id: true } });
        if (existing) return { code: 'PERIOD_EXISTS' as const };
      }

      const parsed = parsePayrollConfig(ruleset.config);
      if ('error' in parsed) return { code: 'BAD_RULESET' as const, error: parsed.error };
      const [year, monthNumber] = period.split('-').map(Number);
      const rangeStart = new Date(Date.UTC(year, monthNumber - 1, 1, 0) - 3_600_000);
      const rangeEnd = new Date(Date.UTC(year, monthNumber, 1, 0) - 3_600_000);
      const employees = (await tx.rhEmployee.findMany({
        where: { tenantId: access.tenantId, status: 'ACTIVO' },
        select: { id: true, baseSalary: true, shift: { select: { startTime: true, endTime: true, isNight: true, nightPremiumPercent: true } } },
        orderBy: { employeeNumber: 'asc' },
      })) as any[];
      const employeeIds = employees.map((employee: any) => employee.id);
      const deductionRows = await tx.rhEmployeeDeduction.findMany({
        where: { tenantId: access.tenantId, active: true, employeeId: { in: employeeIds } },
        select: { employeeId: true, amount: true },
      });
      const timeEntries = (await tx.rhTimeEntry.findMany({
        where: { tenantId: access.tenantId, employeeId: { in: employeeIds }, occurredAt: { gte: rangeStart, lt: rangeEnd } },
        select: { employeeId: true, type: true, occurredAt: true },
      })) as Array<{ employeeId: string; type: TimeEntryLike['type']; occurredAt: Date }>;
      const timeByEmployee = new Map<string, TimeEntryLike[]>();
      for (const entry of timeEntries) {
        const list = timeByEmployee.get(entry.employeeId) ?? [];
        list.push(entry);
        timeByEmployee.set(entry.employeeId, list);
      }
      const deductionByEmployee = new Map<string, number>();
      for (const row of deductionRows as Array<{ employeeId: string; amount: unknown }>) {
        deductionByEmployee.set(row.employeeId, (deductionByEmployee.get(row.employeeId) ?? 0) + Number(row.amount));
      }

      if (employees.length === 0) return { code: 'NO_EMPLOYEES' as const };
      const payslips = employees.map((employee: any) => {
        const baseSalary = Number(employee.baseSalary);
        const extraDeductions = deductionByEmployee.get(employee.id) ?? 0;
        const adjustments = computeTimeAdjustments({
          baseSalary,
          entries: timeByEmployee.get(employee.id) ?? [],
          shift: employee.shift,
          period,
          monthlyHours: parsed.config.monthlyHours,
          overtimeRatePercent: parsed.config.overtimeRatePercent,
          absenceRatePercent: parsed.config.absenceRatePercent,
        });
        const nightAllowance = employee.shift?.isNight ? (baseSalary * (employee.shift.nightPremiumPercent ?? 0)) / 100 : 0;
        const calc = calculatePayslip({ baseSalary, config: parsed.config, extraDeductions, overtimePay: adjustments.overtimePay, absenceDeduction: adjustments.absenceDeduction, nightAllowance });
        const { nightAllowance: _na, ...calcRest } = calc as any;
        return {
          tenantId: access.tenantId,
          employeeId: employee.id,
          ...calcRest,
          lines: {
            ...buildRuleSnapshot(parsed.config, ruleset as any),
            irtBrackets: parsed.config.irtBrackets.length,
            extraDeductions,
            overtimeHours: adjustments.overtimeHours,
            absenceHours: adjustments.absenceHours,
            overtimePay: adjustments.overtimePay,
            absenceDeduction: adjustments.absenceDeduction,
          },
        };
      });
      const totals = payslips.reduce((acc: any, slip: any) => ({
        gross: acc.gross + slip.gross,
        net: acc.net + slip.net,
        inss: acc.inss + slip.inss,
        irt: acc.irt + slip.irt,
      }), { gross: 0, net: 0, inss: 0, irt: 0 });

      // SIMULAÇÃO: não persiste, não amortiza, não altera dados.
      if (mode === 'SIMULACAO') {
        return {
          code: 'SIMULATION_OK' as const,
          period,
          rulesetName: (ruleset as any).name,
          legalStatus,
          totals,
          employees: employees.length,
          payslipCount: payslips.length,
        };
      }

      if (employees.length === 0) return { code: 'NO_EMPLOYEES' as const };
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
      const installments = await tx.rhEmployeeDeduction.findMany({
        where: { tenantId: access.tenantId, active: true, remainingInstallments: { not: null }, employeeId: { in: employeeIds } },
        select: { id: true, remainingInstallments: true },
      });
      for (const item of installments as Array<{ id: string; remainingInstallments: number | null }>) {
        const remaining = Math.max(0, (item.remainingInstallments ?? 1) - 1);
        await tx.rhEmployeeDeduction.update({ where: { id: item.id }, data: { remainingInstallments: remaining, active: remaining > 0 } });
      }
      return { code: 'OK' as const, run, employees: employees.length, totals };
    }, { userId: access.userId });

    if (result.code === 'RULESET_NOT_FOUND') return NextResponse.json({ error: 'Conjunto de regras não encontrado.' }, { status: 404 });
    if (result.code === 'REGRAS_SALARIAIS_NAO_VALIDADAS') return NextResponse.json(REGRAS_NAO_VALIDADAS, { status: 403 });
    if (result.code === 'PERIOD_EXISTS') return NextResponse.json({ error: 'Já existe um processamento oficial para este período.' }, { status: 409 });
    if (result.code === 'BAD_RULESET') return NextResponse.json({ error: `Regras inválidas: ${result.error}` }, { status: 400 });
    if (result.code === 'NO_EMPLOYEES') return NextResponse.json({ error: 'Não há funcionários activos para processar.' }, { status: 400 });
    if (result.code === 'SIMULATION_OK') {
      return NextResponse.json({
        simulation: true,
        period: result.period,
        rulesetName: result.rulesetName,
        legalStatus: result.legalStatus,
        message: result.legalStatus === 'VALIDADO'
          ? 'Simulação com regras validadas. Nada foi persistido.'
          : 'Simulação com regras PENDENTES. NÃO representa processamento oficial. Nada foi persistido.',
        totals: result.totals,
        employees: result.employees,
        payslips: result.payslipCount,
      }, { status: 200 });
    }

    const run = result.run as any;
    try {
      await runWithTenant(access.tenantId, async (tx) => {
        await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_PAYROLL_RUN_CREATED', entity: 'RhPayrollRun', entityId: run.id, metadata: { period: run.period, rulesetId: run.rulesetId, employees: result.employees, totalGross: result.totals.gross, totalNet: result.totals.net } });
      }, { userId: access.userId });
    } catch { /* audit não pode bloquear a criação */ }

    return NextResponse.json({ run, employees: result.employees, totals: result.totals }, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
