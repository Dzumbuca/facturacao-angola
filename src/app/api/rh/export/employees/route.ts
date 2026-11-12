import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhEmployee.findMany({
      where: { tenantId: access.tenantId },
      include: { department: { select: { name: true } }, position: { select: { title: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }), { userId: access.userId })) as any[];

    const csv = toCsv(
      ['numero', 'nome', 'departamento', 'cargo', 'estado', 'admissao', 'vinculo', 'salario_base'],
      rows.map((e) => [e.employeeNumber, `${e.firstName} ${e.lastName}`, e.department?.name ?? '', e.position?.title ?? '', e.status, new Date(e.hireDate).toISOString().slice(0, 10), e.contractType, Number(e.baseSalary).toFixed(2)]),
    );
    return csvResponse('funcionarios.csv', csv);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return Response.json(body, { status });
  }
}
