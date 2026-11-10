import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { DOCUMENT_TYPES } from '@/lib/rh-documents';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('documents:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const templateBody = typeof body.body === 'string' ? body.body.trim() : undefined;
    const type = body.type !== undefined && DOCUMENT_TYPES.includes(body.type) ? body.type : undefined;
    if (name !== undefined && (!name || name.length > 120)) return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
    if (templateBody !== undefined && (!templateBody || templateBody.length > 20_000)) return NextResponse.json({ error: 'Conteúdo inválido.' }, { status: 400 });
    if (name === undefined && templateBody === undefined && type === undefined) return NextResponse.json({ error: 'Nada a actualizar.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhDocumentTemplate.findFirst({ where: { id, tenantId: access.tenantId } });
      if (!existing) return null;
      const nextName = name ?? existing.name;
      const nextType = type ?? existing.type;
      const nextBody = templateBody ?? existing.body;
      const nextVersion = existing.version + 1;
      const updated = await tx.rhDocumentTemplate.update({
        where: { id },
        data: { name: nextName, type: nextType, body: nextBody, version: nextVersion },
      });
      await tx.rhDocumentTemplateVersion.create({
        data: { tenantId: access.tenantId, templateId: id, version: nextVersion, name: nextName, type: nextType, body: nextBody, createdByUserId: access.userId },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DOCUMENT_TEMPLATE_VERSIONED', entity: 'RhDocumentTemplate', entityId: id, metadata: { version: nextVersion } });
      return updated;
    }, { userId: access.userId });

    if (!result) return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um modelo com esse nome.' }, { status: 409 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
