import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { assertDepartmentInTenant, assertPositionInTenant, nextEmployeeNumber, rhAudit } from '@/lib/rh-service';
import { notifyRhUsers } from '@/lib/rh-notify';

type Context = { params: Promise<{ id: string }> };

/** Converte um candidato aprovado em funcionário. Cria o employeeNumber e liga o evento. */
export async function POST(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;
    const positionId = typeof body.positionId === 'string' && body.positionId ? body.positionId : null;
    const hireDate = typeof body.hireDate === 'string' && body.hireDate ? new Date(`${body.hireDate}T00:00:00.000Z`) : new Date();
    const baseSalary = Number.isFinite(Number(body.baseSalary)) && Number(body.baseSalary) >= 0 ? Number(body.baseSalary) : 0;
    if (Number.isNaN(hireDate.getTime())) return NextResponse.json({ error: 'Data de admissão inválida.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const candidate = await tx.rhCandidate.findFirst({
        where: { id, tenantId: access.tenantId },
        include: { jobOpening: { select: { title: true } } },
      });
      if (!candidate) return { code: 'NOT_FOUND' as const };
      if (candidate.status !== 'APROVADO') return { code: 'NOT_APPROVED' as const, status: candidate.status };

      const existing = await tx.rhEmployee.findFirst({
        where: { tenantId: access.tenantId, email: { equals: candidate.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) return { code: 'DUPLICATE_EMAIL' as const };

      if (departmentId) await assertDepartmentInTenant(tx, access.tenantId, departmentId);
      if (positionId) await assertPositionInTenant(tx, access.tenantId, positionId);

      const employeeNumber = await nextEmployeeNumber(tx, access.tenantId);
      const employee = await tx.rhEmployee.create({
        data: {
          tenantId: access.tenantId,
          employeeNumber,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          phone: candidate.phone,
          departmentId,
          positionId,
          hireDate,
          baseSalary,
          status: 'ACTIVO',
        },
      });

      await tx.rhCandidate.update({
        where: { id },
        data: { status: 'ADMITIDO', notes: candidate.notes === null ? null : candidate.notes, events: { create: { tenantId: access.tenantId, fromStatus: 'APROVADO', toStatus: 'ADMITIDO', note: `Admitido como ${employeeNumber}`, createdByUserId: access.userId } } },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_CANDIDATE_ADMITTED', entity: 'RhEmployee', entityId: employee.id, metadata: { candidateId: id, employeeNumber } });
      await notifyRhUsers(tx, {
        tenantId: access.tenantId,
        roles: ['MANAGER', 'ADMIN'],
        title: 'Candidato admitido',
        body: `${candidate.firstName} ${candidate.lastName} → ${employeeNumber}`,
        entityType: 'RhEmployee',
        entityId: employee.id,
      });
      return { code: 'OK' as const, employee, employeeNumber };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
    if (result.code === 'NOT_APPROVED') return NextResponse.json({ error: `Só candidatos aprovados podem ser admitidos (estado actual: ${result.status}).` }, { status: 409 });
    if (result.code === 'DUPLICATE_EMAIL') return NextResponse.json({ error: 'Já existe um funcionário com este email.' }, { status: 409 });
    return NextResponse.json({ employeeId: result.employee.id, employeeNumber: result.employeeNumber }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'DEPARTMENT_NOT_FOUND' || error?.code === 'POSITION_NOT_FOUND') {
      return NextResponse.json({ error: 'Departamento ou cargo inválido.' }, { status: 400 });
    }
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}