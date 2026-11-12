import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhShift.findMany({
      where: { tenantId: access.tenantId },
      include: { _count: { select: { employees: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
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
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const startTime = typeof body.startTime === 'string' ? body.startTime.trim() : '';
    const endTime = typeof body.endTime === 'string' ? body.endTime.trim() : '';
    const tolerance = Number(body.toleranceMinutes ?? 0);
    const isNight = body.isNight === true || body.isNight === 'on';
    const nightPremiumPercent = Number(body.nightPremiumPercent ?? 0);
    if (!name || name.length > 80) return NextResponse.json({ error: 'Nome do horário inválido.' }, { status: 400 });
    if (!TIME.test(startTime) || !TIME.test(endTime)) return NextResponse.json({ error: 'Horas inválidas (HH:MM).' }, { status: 400 });
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 120) return NextResponse.json({ error: 'Tolerância inválida (0–120 min).' }, { status: 400 });
    if (!Number.isInteger(nightPremiumPercent) || nightPremiumPercent < 0 || nightPremiumPercent > 100) return NextResponse.json({ error: 'Prémio nocturno inválido (0–100 %).' }, { status: 400 });

    const created = await runWithTenant(access.tenantId, async (tx) => {
      const row = await tx.rhShift.create({
        data: { tenantId: access.tenantId, name, startTime, endTime, toleranceMinutes: tolerance, isNight, nightPremiumPercent },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_SHIFT_CREATED', entity: 'RhShift', entityId: row.id, metadata: { name, startTime, endTime } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um horário com esse nome.' }, { status: 409 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
