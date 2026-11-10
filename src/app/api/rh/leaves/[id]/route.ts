import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const DECISIONS = ['APROVADO', 'REJEITADO', 'CANCELADO'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (!DECISIONS.includes(body.status)) return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhLeaveRequest.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, status: true } });
      if (!existing) return { code: 'NOT_FOUND' as const };
      if (existing.status !== 'PENDENTE') return { code: 'NOT_PENDING' as const };
      const updated = await tx.rhLeaveRequest.update({
        where: { id },
        data: {
          status: body.status,
          decidedByUserId: body.status === 'CANCELADO' ? null : access.userId,
          decidedAt: new Date(),
          decisionNote: typeof body.decisionNote === 'string' && body.decisionNote.trim() ? body.decisionNote.trim() : null,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: `RH_LEAVE_${body.status}`, entity: 'RhLeaveRequest', entityId: id, metadata: { decision: body.status } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    if (result.code === 'NOT_PENDING') return NextResponse.json({ error: 'Apenas pedidos pendentes podem ser decididos.' }, { status: 409 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
