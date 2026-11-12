import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const ENROLLMENT_STATUSES = ['CONCLUIDA', 'DESISTENTE'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = ENROLLMENT_STATUSES.includes(body.status) ? body.status as (typeof ENROLLMENT_STATUSES)[number] : null;
    const score = body.score === undefined || body.score === null ? null : Number(body.score);
    const certificateUrl = typeof body.certificateUrl === 'string' && body.certificateUrl.trim() ? body.certificateUrl.trim().slice(0, 500) : null;
    if (!status) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
      return NextResponse.json({ error: 'Pontuação deve ser um inteiro entre 0 e 100.' }, { status: 400 });
    }

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const enrollment = await tx.rhTrainingEnrollment.findFirst({
        where: { id, tenantId: access.tenantId },
        include: { employee: { select: { email: true, firstName: true, lastName: true } }, course: { select: { title: true } } },
      });
      if (!enrollment) return { code: 'NOT_FOUND' as const };
      const data: any = { status };
      if (score !== null) data.score = score;
      if (certificateUrl !== null) data.certificateUrl = certificateUrl;
      const updated = await tx.rhTrainingEnrollment.update({ where: { id }, data });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: `RH_TRAINING_${status}`, entity: 'RhTrainingEnrollment', entityId: id, metadata: { score } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Inscrição não encontrada.' }, { status: 404 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}