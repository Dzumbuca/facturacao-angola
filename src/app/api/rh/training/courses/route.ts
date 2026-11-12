import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const STATUSES = ['AGENDADO', 'EM_CURSO', 'CONCLUIDO', 'CANCELADO'] as const;

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const courses = (await runWithTenant(access.tenantId, (tx) => tx.rhTrainingCourse.findMany({
      where: {
        tenantId: access.tenantId,
        ...(status && STATUSES.includes(status as any) ? { status: status as any } : {}),
      },
      include: { enrollments: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, position: { select: { title: true } } } } }, orderBy: { createdAt: 'desc' } } },
      orderBy: { startDate: 'desc' },
      take: 100,
    }), { userId: access.userId })) as any[];
    return NextResponse.json(courses);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('employees:write');
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const startDate = typeof body.startDate === 'string' ? new Date(`${body.startDate}T00:00:00.000Z`) : null;
    const endDate = typeof body.endDate === 'string' && body.endDate ? new Date(`${body.endDate}T23:59:59.999Z`) : null;
    const cargaHoras = Number.isInteger(body.cargaHoras) && body.cargaHoras > 0 ? body.cargaHoras : 8;
    if (!title || title.length > 200) return NextResponse.json({ error: 'Título obrigatório.' }, { status: 400 });
    if (!startDate || Number.isNaN(startDate.getTime())) return NextResponse.json({ error: 'Data de início inválida.' }, { status: 400 });

    const course = await runWithTenant(access.tenantId, async (tx) => {
      const row = await tx.rhTrainingCourse.create({
        data: {
          tenantId: access.tenantId, title,
          trainerName: typeof body.trainerName === 'string' && body.trainerName.trim() ? body.trainerName.trim().slice(0, 160) : null,
          startDate, endDate, cargaHoras,
          location: typeof body.location === 'string' && body.location.trim() ? body.location.trim().slice(0, 200) : null,
          requiredForPositionId: typeof body.requiredForPositionId === 'string' && body.requiredForPositionId ? body.requiredForPositionId : null,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_TRAINING_CREATED', entity: 'RhTrainingCourse', entityId: row.id, metadata: { title, cargaHoras } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await requireRhAccess('employees:write');
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    const status = STATUSES.includes(body.status) ? body.status as (typeof STATUSES)[number] : null;
    if (!id) return NextResponse.json({ error: 'Curso obrigatório.' }, { status: 400 });
    if (!status) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });

    const updated = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhTrainingCourse.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
      if (!existing) return null;
      const row = await tx.rhTrainingCourse.update({ where: { id }, data: { status } });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_TRAINING_STATUS', entity: 'RhTrainingCourse', entityId: id, metadata: { status } });
      return row;
    }, { userId: access.userId });

    if (!updated) return NextResponse.json({ error: 'Curso não encontrado.' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}