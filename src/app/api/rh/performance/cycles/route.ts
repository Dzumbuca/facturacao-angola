import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

export async function GET(_req: Request) {
  try {
    const access = await requireRhAccess();
    const cycles = (await runWithTenant(access.tenantId, (tx) => tx.rhPerformanceCycle.findMany({
      where: { tenantId: access.tenantId },
      include: {
        criteria: { orderBy: { order: 'asc' } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 200, include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, position: { select: { title: true } } } } } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }), { userId: access.userId })) as any[];
    return NextResponse.json(cycles);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('employees:write');
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const startsAt = typeof body.startsAt === 'string' ? new Date(`${body.startsAt}T00:00:00.000Z`) : null;
    const endsAt = typeof body.endsAt === 'string' && body.endsAt ? new Date(`${body.endsAt}T23:59:59.999Z`) : null;
    const criteria: Array<{ name: string; weight: number }> = Array.isArray(body.criteria)
      ? body.criteria.slice(0, 20).map((item: any) => ({
          name: typeof item?.name === 'string' ? item.name.trim().slice(0, 80) : '',
          weight: Number.isInteger(item?.weight) && item.weight > 0 ? item.weight : 1,
        })).filter((item: any) => item.name)
      : [];
    if (!name || name.length > 160) return NextResponse.json({ error: 'Nome do ciclo obrigatório.' }, { status: 400 });
    if (!startsAt || Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: 'Data de início inválida.' }, { status: 400 });
    if (endsAt && Number.isNaN(endsAt.getTime())) return NextResponse.json({ error: 'Data de fim inválida.' }, { status: 400 });

    const cycle = await runWithTenant(access.tenantId, async (tx) => {
      const row = await tx.rhPerformanceCycle.create({
        data: {
          tenantId: access.tenantId, name, startsAt, endsAt,
          criteria: criteria.length ? { create: criteria.map((item, index) => ({ tenantId: access.tenantId, name: item.name, weight: item.weight, order: index })) } : undefined,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_REVIEW_CYCLE_CREATED', entity: 'RhPerformanceCycle', entityId: row.id, metadata: { name, criteria: criteria.length } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}