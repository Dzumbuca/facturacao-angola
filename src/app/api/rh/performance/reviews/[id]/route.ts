import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const STATUSES = ['ENTREGUE', 'VALIDADO'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = STATUSES.includes(body.status) ? body.status as (typeof STATUSES)[number] : null;
    const score = body.score === undefined || body.score === null ? null : Number(body.score);
    const comments = typeof body.comments === 'string' && body.comments.trim() ? body.comments.trim().slice(0, 4000) : null;
    const reviewerName = typeof body.reviewerName === 'string' && body.reviewerName.trim() ? body.reviewerName.trim().slice(0, 160) : null;
    if (status === null && score === null && !comments && !reviewerName) {
      return NextResponse.json({ error: 'Nada a actualizar.' }, { status: 400 });
    }
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
      return NextResponse.json({ error: 'Pontuação deve ser um inteiro entre 0 e 100.' }, { status: 400 });
    }

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const review = await tx.rhPerformanceReview.findFirst({
        where: { id, tenantId: access.tenantId },
        include: { cycle: { select: { status: true } } },
      });
      if (!review) return { code: 'NOT_FOUND' as const };
      if (review.cycle.status === 'FECHADO') return { code: 'CLOSED' as const };

      const data: any = {};
      if (status) data.status = status;
      if (score !== null) data.score = score;
      if (comments !== null) data.comments = comments;
      if (reviewerName !== null) data.reviewerName = reviewerName;

      const updated = await tx.rhPerformanceReview.update({ where: { id }, data });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_PERFORMANCE_REVIEW_UPDATED', entity: 'RhPerformanceReview', entityId: id, metadata: { status, score } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Avaliação não encontrada.' }, { status: 404 });
    if (result.code === 'CLOSED') return NextResponse.json({ error: 'O ciclo está fechado; avaliações não podem ser alteradas.' }, { status: 409 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}