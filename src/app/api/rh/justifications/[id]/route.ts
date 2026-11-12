import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { findUserForEmployee, notifyRhUsers } from '@/lib/rh-notify';

const DECISIONS = ['APROVADO', 'REJEITADO'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('leaves:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (!DECISIONS.includes(body.status)) return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 });
    const decisionNote = typeof body.decisionNote === 'string' && body.decisionNote.trim() ? body.decisionNote.trim().slice(0, 500) : null;

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhAbsenceJustification.findFirst({
        where: { id, tenantId: access.tenantId },
        include: { employee: { select: { email: true } } },
      });
      if (!existing) return { code: 'NOT_FOUND' as const };
      if (existing.status !== 'PENDENTE') return { code: 'NOT_PENDING' as const };

      const updated = await tx.rhAbsenceJustification.update({
        where: { id },
        data: { status: body.status, decisionNote, decidedByUserId: access.userId },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: `RH_JUSTIFICATION_${body.status}`, entity: 'RhAbsenceJustification', entityId: id, metadata: { status: body.status } });

      const employeeUserId = await findUserForEmployee(tx, access.tenantId, existing.employee.email);
      if (employeeUserId) {
        await notifyRhUsers(tx, {
          tenantId: access.tenantId,
          userIds: [employeeUserId],
          title: body.status === 'APROVADO' ? 'Justificação aprovada' : 'Justificação rejeitada',
          body: decisionNote ? `Nota: ${decisionNote}` : 'Consulte a sua justificação em Meu RH.',
          entityType: 'RhAbsenceJustification',
          entityId: id,
        });
      }
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Justificação não encontrada.' }, { status: 404 });
    if (result.code === 'NOT_PENDING') return NextResponse.json({ error: 'Apenas pedidos pendentes podem ser decididos.' }, { status: 409 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}