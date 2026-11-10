import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { assertDepartmentInTenant, assertPositionInTenant, nextEmployeeNumber, rhAudit } from '@/lib/rh-service';
type RhContractType = 'INDEFINIDO' | 'TERMO_CERTO' | 'ESTAGIO' | 'PRESTACAO_SERVICOS';
type RhEmployeeStatus = 'ACTIVO' | 'SUSPENSO' | 'FERIAS' | 'CESSAO' | 'INACTIVO';

const CONTRACT_TYPES: RhContractType[] = ['INDEFINIDO', 'TERMO_CERTO', 'ESTAGIO', 'PRESTACAO_SERVICOS'];
const STATUSES: RhEmployeeStatus[] = ['ACTIVO', 'SUSPENSO', 'FERIAS', 'CESSAO', 'INACTIVO'];

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const status = url.searchParams.get('status');
    const where: any = { tenantId: access.tenantId };
    if (status && STATUSES.includes(status as RhEmployeeStatus)) where.status = status;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { employeeNumber: { contains: q, mode: 'insensitive' } },
        { bi: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhEmployee.findMany({
      where,
      include: { department: { select: { id: true, name: true } }, position: { select: { id: true, title: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 200,
    }), { userId: access.userId })) as any[];
    return NextResponse.json((rows as any[]).map((row) => ({ ...row, baseSalary: Number(row.baseSalary) })));
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const hireDate = parseDate(body.hireDate);
    const baseSalary = Number(body.baseSalary);
    if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80) {
      return NextResponse.json({ error: 'Nome e apelido são obrigatórios.' }, { status: 400 });
    }
    if (!hireDate) return NextResponse.json({ error: 'Data de admissão inválida.' }, { status: 400 });
    if (!Number.isFinite(baseSalary) || baseSalary < 0) {
      return NextResponse.json({ error: 'Salário-base inválido.' }, { status: 400 });
    }
    const contractType = CONTRACT_TYPES.includes(body.contractType) ? body.contractType : 'INDEFINIDO';
    const status = STATUSES.includes(body.status) ? body.status : 'ACTIVO';

    const created = await runWithTenant(access.tenantId, async (tx) => {
      const departmentId = await assertDepartmentInTenant(tx, access.tenantId, body.departmentId);
      const positionId = await assertPositionInTenant(tx, access.tenantId, body.positionId);
      const employeeNumber = await nextEmployeeNumber(tx, access.tenantId);
      const employee = await tx.rhEmployee.create({
        data: {
          tenantId: access.tenantId,
          employeeNumber,
          firstName,
          lastName,
          bi: body.bi?.trim() || null,
          nif: body.nif?.trim() || null,
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
          address: body.address?.trim() || null,
          birthDate: parseDate(body.birthDate),
          gender: body.gender?.trim() || null,
          photoUrl: body.photoUrl?.trim() || null,
          departmentId,
          positionId,
          hireDate,
          contractType,
          baseSalary,
          status,
          bankName: body.bankName?.trim() || null,
          bankAccount: body.bankAccount?.trim() || null,
          bankIban: body.bankIban?.trim() || null,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_EMPLOYEE_CREATED', entity: 'RhEmployee', entityId: employee.id, metadata: { employeeNumber, firstName, lastName } });
      return employee;
    }, { userId: access.userId });

    return NextResponse.json({ ...created, baseSalary: Number(created.baseSalary) }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'DEPARTMENT_NOT_FOUND' || error?.message === 'POSITION_NOT_FOUND') {
      return NextResponse.json({ error: 'Departamento ou cargo inválido.' }, { status: 400 });
    }
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
