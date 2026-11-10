import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { assertDepartmentInTenant, assertPositionInTenant, rhAudit } from '@/lib/rh-service';
type RhContractType = 'INDEFINIDO' | 'TERMO_CERTO' | 'ESTAGIO' | 'PRESTACAO_SERVICOS';
type RhEmployeeStatus = 'ACTIVO' | 'SUSPENSO' | 'FERIAS' | 'CESSAO' | 'INACTIVO';

const CONTRACT_TYPES: RhContractType[] = ['INDEFINIDO', 'TERMO_CERTO', 'ESTAGIO', 'PRESTACAO_SERVICOS'];
const STATUSES: RhEmployeeStatus[] = ['ACTIVO', 'SUSPENSO', 'FERIAS', 'CESSAO', 'INACTIVO'];
type Context = { params: Promise<{ id: string }> };

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: any = {};
    for (const key of ['firstName', 'lastName', 'bi', 'nif', 'email', 'phone', 'address', 'gender', 'photoUrl', 'bankName', 'bankAccount', 'bankIban'] as const) {
      if (body[key] !== undefined) data[key] = typeof body[key] === 'string' && body[key].trim() ? body[key].trim() : null;
    }
    if (data.firstName === null || data.lastName === null) {
      return NextResponse.json({ error: 'Nome e apelido são obrigatórios.' }, { status: 400 });
    }
    const birthDate = parseDate(body.birthDate);
    if (birthDate !== undefined) data.birthDate = birthDate;
    const hireDate = parseDate(body.hireDate);
    if (hireDate) data.hireDate = hireDate;
    if (body.baseSalary !== undefined) {
      const salary = Number(body.baseSalary);
      if (!Number.isFinite(salary) || salary < 0) return NextResponse.json({ error: 'Salário inválido.' }, { status: 400 });
      data.baseSalary = salary;
    }
    if (body.status !== undefined && STATUSES.includes(body.status)) data.status = body.status;
    if (body.contractType !== undefined && CONTRACT_TYPES.includes(body.contractType)) data.contractType = body.contractType;

    const updated = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhEmployee.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
      if (!existing) return null;
      if (body.departmentId !== undefined) data.departmentId = await assertDepartmentInTenant(tx, access.tenantId, body.departmentId);
      if (body.positionId !== undefined) data.positionId = await assertPositionInTenant(tx, access.tenantId, body.positionId);
      const employee = await tx.rhEmployee.update({ where: { id }, data });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_EMPLOYEE_UPDATED', entity: 'RhEmployee', entityId: id, metadata: { fields: Object.keys(data) } });
      return employee;
    }, { userId: access.userId });

    if (!updated) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    return NextResponse.json({ ...updated, baseSalary: Number(updated.baseSalary) });
  } catch (error: any) {
    if (error?.message === 'DEPARTMENT_NOT_FOUND' || error?.message === 'POSITION_NOT_FOUND') {
      return NextResponse.json({ error: 'Departamento ou cargo inválido.' }, { status: 400 });
    }
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
