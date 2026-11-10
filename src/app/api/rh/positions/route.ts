import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhPosition.findMany({
      where: { tenantId: access.tenantId },
      include: { department: { select: { id: true, name: true } }, _count: { select: { employees: true } } },
      orderBy: [{ title: 'asc' }],
    }), { userId: access.userId });
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 100) return NextResponse.json({ error: 'Título do cargo inválido.' }, { status: 400 });
    const created = await runWithTenant(access.tenantId, async (tx) => {
      let departmentId: string | null = null;
      if (body.departmentId) {
        const dept = await tx.rhDepartment.findFirst({ where: { id: String(body.departmentId), tenantId: access.tenantId }, select: { id: true } });
        if (!dept) throw new Error('DEPARTMENT_NOT_FOUND');
        departmentId = dept.id;
      }
      const row = await tx.rhPosition.create({
        data: {
          tenantId: access.tenantId,
          title,
          code: body.code?.trim() || null,
          departmentId,
          level: Number.isInteger(Number(body.level)) ? Number(body.level) : null,
          description: body.description?.trim() || null,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_POSITION_CREATED', entity: 'RhPosition', entityId: row.id, metadata: { title } });
      return row;
    }, { userId: access.userId });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um cargo com esse título neste departamento.' }, { status: 409 });
    if (error?.message === 'DEPARTMENT_NOT_FOUND') return NextResponse.json({ error: 'Departamento inválido.' }, { status: 400 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
