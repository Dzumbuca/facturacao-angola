import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { contentHash } from '@/lib/rh-documents';

const DECISIONS = ['EMITIDO', 'ANULADO'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (!DECISIONS.includes(body.status)) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhDocument.findFirst({ where: { id, tenantId: access.tenantId } });
      if (!existing) return { code: 'NOT_FOUND' as const };
      if (existing.status !== 'RASCUNHO') return { code: 'NOT_DRAFT' as const };
      const updated = await tx.rhDocument.update({
        where: { id },
        data: {
          status: body.status,
          hash: body.status === 'EMITIDO' ? contentHash(existing.content) : null,
          issuedAt: body.status === 'EMITIDO' ? new Date() : null,
          issuedByUserId: body.status === 'EMITIDO' ? access.userId : null,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: `RH_DOCUMENT_${body.status}`, entity: 'RhDocument', entityId: id, metadata: { status: body.status } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    if (result.code === 'NOT_DRAFT') return NextResponse.json({ error: 'Apenas rascunhos podem ser emitidos ou anulados.' }, { status: 409 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
