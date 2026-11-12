import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const OPENING_STATUSES = ['ABERTA', 'ENCERRADA', 'CANCELADA'] as const;

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const openings = (await runWithTenant(access.tenantId, (tx) => tx.rhJobOpening.findMany({
      where: {
        tenantId: access.tenantId,
        ...(status && OPENING_STATUSES.includes(status as any) ? { status: status as any } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        _count: { select: { candidates: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }), { userId: access.userId })) as any[];
    return NextResponse.json(openings);
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
    const openings = Number.isInteger(body.openings) && body.openings > 0 ? body.openings : 1;
    const requirements = typeof body.requirements === 'string' && body.requirements.trim() ? body.requirements.trim().slice(0, 4000) : null;
    const closesAt = typeof body.closesAt === 'string' && body.closesAt ? new Date(`${body.closesAt}T23:59:59.999Z`) : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null;
    const positionId = typeof body.positionId === 'string' && body.positionId ? body.positionId : null;
    if (!title || title.length > 160) return NextResponse.json({ error: 'Título obrigatório.' }, { status: 400 });
    if (closesAt && Number.isNaN(closesAt.getTime())) return NextResponse.json({ error: 'Data de fecho inválida.' }, { status: 400 });

    const created = await runWithTenant(access.tenantId, async (tx) => {
      if (departmentId) {
        const dept = await tx.rhDepartment.findFirst({ where: { id: departmentId, tenantId: access.tenantId }, select: { id: true } });
        if (!dept) throw Object.assign(new Error('DEPARTMENT_NOT_FOUND'), { code: 'DEPARTMENT_NOT_FOUND' });
      }
      if (positionId) {
        const position = await tx.rhPosition.findFirst({ where: { id: positionId, tenantId: access.tenantId }, select: { id: true } });
        if (!position) throw Object.assign(new Error('POSITION_NOT_FOUND'), { code: 'POSITION_NOT_FOUND' });
      }
      const row = await tx.rhJobOpening.create({
        data: { tenantId: access.tenantId, title, departmentId, positionId, openings, requirements, closesAt },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_JOB_OPENING_CREATED', entity: 'RhJobOpening', entityId: row.id, metadata: { title, openings } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'DEPARTMENT_NOT_FOUND' || error?.code === 'POSITION_NOT_FOUND') {
      return NextResponse.json({ error: 'Departamento ou cargo inválido.' }, { status: 400 });
    }
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}