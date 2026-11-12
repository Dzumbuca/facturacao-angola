import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { toCsv, csvResponse } from '@/lib/csv';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const run = (await runWithTenant(access.tenantId, (tx) => tx.rhPayrollRun.findFirst({
      where: { id, tenantId: access.tenantId },
      select: { id: true, period: true, payslips: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } }, orderBy: { employeeId: 'asc' } } },
    }), { userId: access.userId })) as any;
    if (!run) return NextResponse.json({ error: 'Processamento não encontrado.' }, { status: 404 });

    const csv = toCsv(
      ['numero', 'funcionario', 'base', 'subsidios', 'horas_extra', 'faltas', 'bruto', 'inss', 'irt', 'outros_descontos', 'liquido'],
      run.payslips.map((slip: any) => [
        slip.employee.employeeNumber,
        `${slip.employee.firstName} ${slip.employee.lastName}`,
        Number(slip.baseSalary).toFixed(2), Number(slip.allowances).toFixed(2), Number(slip.overtime).toFixed(2),
        Number(slip.absences).toFixed(2), Number(slip.gross).toFixed(2), Number(slip.inss).toFixed(2),
        Number(slip.irt).toFixed(2), Number(slip.otherDeductions).toFixed(2), Number(slip.net).toFixed(2),
      ]),
    );
    return csvResponse(`folha-${run.period}.csv`, csv);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
