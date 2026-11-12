import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { notifyRhUsers } from '@/lib/rh-notify';

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('employees:write');
    const body = await req.json().catch(() => ({}));
    const courseId = typeof body.courseId === 'string' ? body.courseId : '';
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    if (!courseId) return NextResponse.json({ error: 'Curso obrigatório.' }, { status: 400 });
    if (!employeeId) return NextResponse.json({ error: 'Funcionário obrigatório.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const course = await tx.rhTrainingCourse.findFirst({ where: { id: courseId, tenantId: access.tenantId }, select: { id: true, title: true, status: true } });
      if (!course) return { code: 'NOT_FOUND_COURSE' as const };
      if (course.status === 'CANCELADO') return { code: 'CANCELLED' as const };
      const employee = await tx.rhEmployee.findFirst({ where: { id: employeeId, tenantId: access.tenantId }, select: { id: true, firstName: true, lastName: true, email: true } });
      if (!employee) return { code: 'NOT_FOUND_EMPLOYEE' as const };

      const existing = await tx.rhTrainingEnrollment.findUnique({
        where: { courseId_employeeId: { courseId, employeeId } },
        select: { id: true },
      });
      if (existing) return { code: 'DUPLICATE' as const };

      const row = await tx.rhTrainingEnrollment.create({
        data: { tenantId: access.tenantId, courseId, employeeId },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_TRAINING_ENROLLED', entity: 'RhTrainingEnrollment', entityId: row.id, metadata: { courseId, employeeId } });
      await notifyRhUsers(tx, {
        tenantId: access.tenantId,
        roles: ['MANAGER', 'ADMIN'],
        title: 'Inscrição em formação',
        body: `${employee.firstName} ${employee.lastName} → ${course.title}`,
        entityType: 'RhTrainingEnrollment',
        entityId: row.id,
      });
      return { code: 'OK' as const, row };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND_COURSE') return NextResponse.json({ error: 'Curso não encontrado.' }, { status: 404 });
    if (result.code === 'NOT_FOUND_EMPLOYEE') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    if (result.code === 'CANCELLED') return NextResponse.json({ error: 'Curso cancelado.' }, { status: 409 });
    if (result.code === 'DUPLICATE') return NextResponse.json({ code: 'DUPLICATE', error: 'Funcionário já inscrito neste curso.' }, { status: 409 });
    return NextResponse.json(result.row, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}