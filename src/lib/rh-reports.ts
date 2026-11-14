import { runWithTenant } from './tenant-db';
import type { ReportPeriod } from './report-period';
import type { ReportDataset } from './report-data';
type Emp = any;
type TimeEntry = any;
type LeaveRow = any;
type PayrollRun = any;
type DeductionRow = any;
type ContractRow = any;

export type RhReportKind = 'employees' | 'attendance' | 'leaves' | 'payroll' | 'deductions' | 'contracts';

export const RH_REPORT_KINDS: readonly RhReportKind[] = ['employees', 'attendance', 'leaves', 'payroll', 'deductions', 'contracts'];
export const isRhReportKind = (kind: string): kind is RhReportKind => (RH_REPORT_KINDS as readonly string[]).includes(kind);

const toDateKey = (d: Date | null | undefined) => (d ? d.toLocaleDateString('pt-AO') : '—');
const n = (v: unknown) => Number(v ?? 0);

export async function getRhReportDataset(
  tenantId: string,
  period: ReportPeriod,
  kind: RhReportKind,
  departmentId: string | null = null,
  employeeId: string | null = null,
  status: string | null = null,
): Promise<ReportDataset> {
  return runWithTenant(tenantId, async (tx) => {
    const [tenant] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, nif: true } }),
    ]);
    const company = { name: tenant?.name ?? '', nif: tenant?.nif ?? null };
    const periodFilter = { gte: period.start, lt: period.endExclusive };
    if (kind === 'employees') {
      const rows: Emp[] = await tx.rhEmployee.findMany({
        where: { tenantId, ...(departmentId ? { departmentId } : {}), ...(employeeId ? { id: employeeId } : {}), ...(status ? { status } : {}) },
        include: { department: { select: { name: true } }, position: { select: { title: true } } },
        orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
        take: 10000,
      });
      const total = rows.reduce((sum, e) => sum + n(e.baseSalary), 0);
      return {
        kind: kind as any, title: 'Relatório de Funcionários', company, period, generatedAt: new Date(),
        filters: { customerId: null, state: status ?? null, warehouseId: null, productId: null },
        headers: ['Nº', 'Nome', 'Departamento', 'Cargo', 'Admissão', 'Salário (AOA)', 'Estado'],
        rows: rows.map((e) => [e.employeeNumber, `${e.firstName} ${e.lastName}`, e.department?.name ?? '—', e.position?.title ?? '—', toDateKey(e.hireDate), n(e.baseSalary), e.status]),
        totals: ['Totais', `${rows.length} funcionários`, '', '', '', total, ''],
      };
    }

    if (kind === 'attendance') {
      const rows: TimeEntry[] = await tx.rhTimeEntry.findMany({
        where: { tenantId, occurredAt: periodFilter, ...(employeeId ? { employeeId } : {}) },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, departmentId: true, department: { select: { name: true } } } } },
        orderBy: [{ occurredAt: 'asc' }, { employeeId: 'asc' }],
        take: 20000,
      });
      // Presença única por dia/funcionário (não duplica marcações)
      const presence = new Map<string, { firstIn: Date | null; lastOut: Date | null; lateMinutes: number }>();
      for (const entry of rows) {
        const key = `${entry.employeeId}|${entry.occurredAt.toISOString().slice(0, 10)}`;
        const rec = presence.get(key) ?? { firstIn: null, lastOut: null, lateMinutes: 0 };
        if (entry.type === 'ENTRADA' && (!rec.firstIn || entry.occurredAt < rec.firstIn)) rec.firstIn = entry.occurredAt;
        if (entry.type === 'SAIDA' && (!rec.lastOut || entry.occurredAt > rec.lastOut)) rec.lastOut = entry.occurredAt;
        presence.set(key, rec);
      }
      const employeeIds = [...new Set(rows.map((r: any) => r.employeeId))];
      const employees: Emp[] = employeeIds.length ? await tx.rhEmployee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: { select: { name: true } } } }) : [];
      const byEmployee = new Map(employees.map((e) => [e.id, e]));
      const grouped = new Map<string, any>();
      for (const [key, rec] of Array.from(presence)) {
        const [employeeId] = key.split('|');
        const emp = byEmployee.get(employeeId);
        if (!emp) continue;
        if (!grouped.has(employeeId)) grouped.set(employeeId, { emp, days: 0, firstIn: null as Date | null, lastOut: null as Date | null });
        const g = grouped.get(employeeId);
        g.days += 1;
        if (rec.firstIn && (!g.firstIn || rec.firstIn < g.firstIn)) g.firstIn = rec.firstIn;
        if (rec.lastOut && (!g.lastOut || rec.lastOut > g.lastOut)) g.lastOut = rec.lastOut;
      }
      const outRows = [...grouped.values()].map((g) => [g.emp.employeeNumber, `${g.emp.firstName} ${g.emp.lastName}`, g.emp.department?.name ?? '—', toDateKey(g.firstIn), toDateKey(g.lastOut), g.days]);
      return {
        kind: kind as any, title: 'Relatório de Assiduidade', company, period, generatedAt: new Date(),
        filters: { customerId: null, state: null, warehouseId: null, productId: null },
        headers: ['Nº', 'Nome', 'Departamento', 'Primeira entrada', 'Última saída', 'Dias com marcação'],
        rows: outRows,
        totals: ['Totais', `${outRows.length} funcionários`, '', '', '', outRows.reduce((sum, r) => sum + n(r[5]), 0)],
      };
    }

    if (kind === 'leaves') {
      const rows: LeaveRow[] = await tx.rhLeaveRequest.findMany({
        where: { tenantId, ...(employeeId ? { employeeId } : {}), ...(status ? { status } : {}), startDate: periodFilter },
        include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, department: { select: { name: true } } } } },
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        take: 10000,
      });
      const totals: Record<string, number> = {};
      for (const r of rows) totals[r.status] = (totals[r.status] ?? 0) + 1;
      return {
        kind: kind as any, title: 'Relatório de Férias e Licenças', company, period, generatedAt: new Date(),
        filters: { customerId: null, state: status ?? null, warehouseId: null, productId: null },
        headers: ['Nº', 'Nome', 'Departamento', 'Tipo', 'Dias', 'Estado', 'Início', 'Fim'],
        rows: rows.map((r) => [r.employee.employeeNumber, `${r.employee.firstName} ${r.employee.lastName}`, r.employee.department?.name ?? '—', r.type, r.days, r.status, toDateKey(r.startDate), toDateKey(r.endDate)]),
        totals: ['Totais', `${rows.length} pedidos`, '', '', '', Object.entries(totals).map(([k, v]) => `${k}:${v}`).join(' · ')],
      };
    }

    if (kind === 'payroll') {
      const rows: PayrollRun[] = await tx.rhPayrollRun.findMany({
        where: { tenantId, createdAt: periodFilter },
        include: { ruleset: { select: { name: true } }, _count: { select: { payslips: true } } },
        orderBy: { period: 'desc' },
        take: 1000,
      });
      const totalGross = rows.reduce((sum, r) => sum + n(r.totalGross), 0);
      const totalNet = rows.reduce((sum, r) => sum + n(r.totalNet), 0);
      const totalInss = rows.reduce((sum, r) => sum + n(r.totalInss), 0);
      const totalIrt = rows.reduce((sum, r) => sum + n(r.totalIrt), 0);
      return {
        kind: kind as any, title: 'Relatório de Processamento Salarial', company, period, generatedAt: new Date(),
        filters: { customerId: null, state: null, warehouseId: null, productId: null },
        headers: ['Período', 'Ruleset', 'Funcionários', 'Bruto (AOA)', 'Líquido (AOA)', 'INSS (AOA)', 'IRT (AOA)', 'Estado'],
        rows: rows.map((r) => [r.period, r.ruleset?.name ?? '—', r._count.payslips, n(r.totalGross), n(r.totalNet), n(r.totalInss), n(r.totalIrt), r.status]),
        totals: ['Totais', `${rows.length} processamentos`, '', totalGross, totalNet, totalInss, totalIrt, ''],
      };
    }

    if (kind === 'deductions') {
      const rows: DeductionRow[] = await tx.rhEmployeeDeduction.findMany({
        where: { tenantId, ...(employeeId ? { employeeId } : {}), ...(status ? { active: status === 'ativo' } : {}) },
        include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, department: { select: { name: true } } } } },
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        take: 10000,
      });
      const totalActive = rows.filter((r) => r.active).reduce((sum, r) => sum + n(r.amount), 0);
      return {
        kind: kind as any, title: 'Relatório de Descontos', company, period, generatedAt: new Date(),
        filters: { customerId: null, state: status ?? null, warehouseId: null, productId: null },
        headers: ['Nº', 'Nome', 'Departamento', 'Descrição', 'Tipo', 'Valor (AOA)', 'Prestações', 'Estado'],
        rows: rows.map((r) => [r.employee.employeeNumber, `${r.employee.firstName} ${r.employee.lastName}`, r.employee.department?.name ?? '—', r.description, r.type, n(r.amount), r.remainingInstallments ?? '—', r.active ? 'ACTIVO' : 'CONCLUÍDO']),
        totals: ['Totais', `${rows.length} descontos`, '', '', '', totalActive, '', ''],
      };
    }

    // contracts
    const rows: ContractRow[] = await tx.rhContract.findMany({
      where: { tenantId, ...(employeeId ? { employeeId } : {}), ...(status ? { status } : {}), ...(departmentId ? { employee: { departmentId } } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, departmentId: true, department: { select: { name: true } } } } },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      take: 10000,
    });
    const now = new Date();
    const total = rows.reduce((sum, r) => sum + n(r.salary), 0);
    const vencendo = rows.filter((r) => r.endDate && new Date(r.endDate).getTime() - now.getTime() < 30 * 86400000).length;
    return {
      kind: kind as any, title: 'Relatório de Contratos', company, period, generatedAt: new Date(),
      filters: { customerId: null, state: status ?? null, warehouseId: null, productId: null },
      headers: ['Nº', 'Nome', 'Departamento', 'Tipo', 'Início', 'Fim', 'Salário (AOA)', 'Estado'],
      rows: rows.map((r) => [r.employee.employeeNumber, `${r.employee.firstName} ${r.employee.lastName}`, r.employee.department?.name ?? '—', r.type, toDateKey(r.startDate), toDateKey(r.endDate), n(r.salary), r.status]),
      totals: ['Totais', `${rows.length} contratos`, '', '', '', `a vencer: ${vencendo}`, total, ''],
    };
  });
}
