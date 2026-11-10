import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { DOCUMENT_TYPES } from '@/lib/rh-documents';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhDocumentTemplate.findMany({
      where: { tenantId: access.tenantId },
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
    const access = await requireRhAccess('documents:write');
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const templateBody = typeof body.body === 'string' ? body.body.trim() : '';
    const type = DOCUMENT_TYPES.includes(body.type) ? body.type : 'OUTRO';
    if (!name || name.length > 120) return NextResponse.json({ error: 'Nome do modelo inválido.' }, { status: 400 });
    if (!templateBody || templateBody.length > 20_000) return NextResponse.json({ error: 'Conteúdo do modelo inválido.' }, { status: 400 });

    const created = await runWithTenant(access.tenantId, async (tx) => {
      const row = await tx.rhDocumentTemplate.create({
        data: { tenantId: access.tenantId, name, type, body: templateBody },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DOCUMENT_TEMPLATE_CREATED', entity: 'RhDocumentTemplate', entityId: row.id, metadata: { name, type } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um modelo com esse nome.' }, { status: 409 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
