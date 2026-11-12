import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

/** Marca um modelo de documento como VALIDADO com evidência documental. */
export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('settings:write');
    const body = await req.json().catch(() => ({}));
    const templateId = typeof body.templateId === 'string' ? body.templateId : '';
    const documentUrl = typeof body.documentUrl === 'string' && body.documentUrl.trim() ? body.documentUrl.trim().slice(0, 1000) : null;
    const validatedByName = typeof body.validatedByName === 'string' && body.validatedByName.trim() ? body.validatedByName.trim().slice(0, 160) : null;
    if (!templateId) return NextResponse.json({ error: 'Modelo obrigatório.' }, { status: 400 });
    if (!documentUrl) return NextResponse.json({ error: 'É necessário anexar a evidência documental (URL).' }, { status: 400 });
    if (!validatedByName) return NextResponse.json({ error: 'Identificar quem valida (nome e função).' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhDocumentTemplate.findFirst({ where: { id: templateId, tenantId: access.tenantId }, select: { id: true, legalStatus: true } });
      if (!existing) return { code: 'NOT_FOUND' as const };
      const updated = await tx.rhDocumentTemplate.update({
        where: { id: templateId },
        data: { legalStatus: 'VALIDADO', legalDocumentUrl: documentUrl, legalValidatedBy: validatedByName, legalValidatedAt: new Date() },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DOCUMENT_TEMPLATE_LEGAL_VALIDATED', entity: 'RhDocumentTemplate', entityId: templateId, metadata: { documentUrl, validatedByName } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}