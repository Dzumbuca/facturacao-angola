import { NextResponse } from 'next/server';

import bcrypt from 'bcrypt';

import { runWithTenant } from '@/lib/tenant-db';

import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';

import { assertDepartmentInTenant, assertPositionInTenant, assertShiftInTenant, maskAccount, rhAudit } from '@/lib/rh-service';
import { hasRhPermission } from '@/lib/rh-policy';

type RhContractType = 'INDEFINIDO' | 'TERMO_CERTO' | 'ESTAGIO' | 'PRESTACAO_SERVICOS';

type RhEmployeeStatus = 'ACTIVO' | 'SUSPENSO' | 'FERIAS' | 'CESSAO' | 'INACTIVO';



function serializeEmployee(employee: any) {
  const { pinHash, bankAccount, bankIban, ...rest } = employee;
  return { ...rest, baseSalary: Number(rest.baseSalary), hasPin: Boolean(pinHash), bankAccount: maskAccount(bankAccount), bankIban: maskAccount(bankIban) };
}



const CONTRACT_TYPES: RhContractType[] = ['INDEFINIDO', 'TERMO_CERTO', 'ESTAGIO', 'PRESTACAO_SERVICOS'];

const STATUSES: RhEmployeeStatus[] = ['ACTIVO', 'SUSPENSO', 'FERIAS', 'CESSAO', 'INACTIVO'];

type Context = { params: Promise<{ id: string }> };



function parseDate(value: unknown): Date | null | undefined {

  if (value === undefined) return undefined;

  if (value === null || value === '') return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? undefined : date;

}



export async function GET(_req: Request, { params }: Context) {

  try {

    const access = await requireRhAccess();

    const { id } = await params;

    const employee = (await runWithTenant(access.tenantId, (tx) => tx.rhEmployee.findFirst({

      where: { id, tenantId: access.tenantId },

      include: { department: { select: { id: true, name: true } }, position: { select: { id: true, title: true } }, shift: { select: { id: true, name: true, startTime: true, endTime: true } } },

    }), { userId: access.userId })) as any;

    if (!employee) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });

    const canSeeBank = hasRhPermission(access.permissions, 'employees:write');

    const { pinHash, bankAccount, bankIban, ...rest } = employee;

    return NextResponse.json({ ...rest, baseSalary: Number(rest.baseSalary), hasPin: Boolean(pinHash), bankAccount: canSeeBank ? bankAccount : maskAccount(bankAccount), bankIban: canSeeBank ? bankIban : maskAccount(bankIban) });

  } catch (error) {

    const { status, body } = rhAccessResponse(error);

    return NextResponse.json(body, { status });

  }

}

export async function PATCH(req: Request, { params }: Context) {

  try {

    const access = await requireRhAccess('employees:write');

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

    if (body.pin !== undefined) {

      const pin = String(body.pin ?? '').trim();

      if (pin && !/^\d{4,8}$/.test(pin)) return NextResponse.json({ error: 'O PIN deve ter 4 a 8 dígitos.' }, { status: 400 });

      data.pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    }

    if (body.contractType !== undefined && CONTRACT_TYPES.includes(body.contractType)) data.contractType = body.contractType;



    const updated = await runWithTenant(access.tenantId, async (tx) => {

      const existing = await tx.rhEmployee.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, baseSalary: true } });

      if (!existing) return null;

      const oldSalary = Number(existing.baseSalary);

      if (body.departmentId !== undefined) data.departmentId = await assertDepartmentInTenant(tx, access.tenantId, body.departmentId);

      if (body.positionId !== undefined) data.positionId = await assertPositionInTenant(tx, access.tenantId, body.positionId);
      if (body.shiftId !== undefined) data.shiftId = await assertShiftInTenant(tx, access.tenantId, body.shiftId);

      const employee = await tx.rhEmployee.update({ where: { id }, data });

      const salaryChanged = data.baseSalary !== undefined && Number(data.baseSalary) !== oldSalary;

      if (salaryChanged) {

        await tx.rhSalaryChange.create({

          data: {

            tenantId: access.tenantId,

            employeeId: id,

            oldSalary,

            newSalary: Number(data.baseSalary),

            effectiveDate: body.salaryEffectiveDate ? new Date(String(body.salaryEffectiveDate)) : new Date(),

            reason: typeof body.salaryReason === 'string' && body.salaryReason.trim() ? body.salaryReason.trim() : null,

            createdByUserId: access.userId,

          },

        });

      }

      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_EMPLOYEE_UPDATED', entity: 'RhEmployee', entityId: id, metadata: { fields: Object.keys(data), salaryChanged, oldSalary, newSalary: salaryChanged ? Number(data.baseSalary) : undefined } });

      return employee;

    }, { userId: access.userId });



    if (!updated) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });

    return NextResponse.json(serializeEmployee(updated));

  } catch (error: any) {

    if (['DEPARTMENT_NOT_FOUND', 'POSITION_NOT_FOUND', 'SHIFT_NOT_FOUND'].includes(error?.message)) {

      return NextResponse.json({ error: 'Departamento ou cargo inválido.' }, { status: 400 });

    }

    const { status, body } = rhAccessResponse(error);

    return NextResponse.json(body, { status });

  }

}

