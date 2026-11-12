import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const NEXT: Record<string, string[]> = {
  RECEBIDA: ['TRIAGEM', 'REJEITADO'],
  TRIAGEM: ['ENTREVISTA', 'REJEITADO'],
  ENTREVISTA: ['AVALIACAO', 'REJEITADO'],
  AVALIACAO: ['APROVADO', 'REJEITADO'],
  APROVADO: ['ADMITIDO', 'REJEITADO'],
  REJEITADO: [],
  ADMITIDO: [],
};

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const toStatus = typeof body.status === 'string' ? body.status : '';
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : null;
    if (!Object.keys(NEXT).includes(toStatus)) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const candidate = await tx.rhCandidate.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, status: true } });
      if (!candidate) return { code: 'NOT_FOUND' as const };
      const allowed = NEXT[candidate.status] ?? [];
      if (!allowed.includes(toStatus)) return { code: 'TRANSITION' as const, allowed, from: candidate.status };

      const updated = await tx.rhCandidate.update({
        where: { id },
        data: { status: toStatus as never, events: { create: { tenantId: access.tenantId, fromStatus: candidate.status, toStatus: toStatus as never, note, createdByUserId: access.userId } } },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_CANDIDATE_STAGE', entity: 'RhCandidate', entityId: id, metadata: { from: candidate.status, to: toStatus } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
    if (result.code === 'TRANSITION') return NextResponse.json({ error: `Transição não permitida de ${result.from}.`, allowed: result.allowed }, { status: 409 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}