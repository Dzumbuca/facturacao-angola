import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const OPENING_STATUSES = ['ABERTA', 'ENCERRADA', 'CANCELADA'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = OPENING_STATUSES.includes(body.status) ? body.status : null;
    if (!status) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });

    const data: any = { status };
    if (typeof body.requirements === 'string') data.requirements = body.requirements.trim().slice(0, 4000) || null;
    if (typeof body.closesAt === 'string' && body.closesAt) data.closesAt = new Date(`${body.closesAt}T23:59:59.999Z`);

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhJobOpening.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, status: true } });
      if (!existing) return { code: 'NOT_FOUND' as const };
      if (existing.status === 'CANCELADA' && status !== 'ABERTA') return { code: 'CANCELLED' as const };
      const updated = await tx.rhJobOpening.update({ where: { id }, data });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_JOB_OPENING_UPDATED', entity: 'RhJobOpening', entityId: id, metadata: { status } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Vaga não encontrada.' }, { status: 404 });
    if (result.code === 'CANCELLED') return NextResponse.json({ error: 'A vaga cancelada não pode ser alterada.' }, { status: 409 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}