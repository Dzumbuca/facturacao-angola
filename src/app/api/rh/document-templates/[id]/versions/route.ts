import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const versions = await runWithTenant(access.tenantId, async (tx) => {
      const template = await tx.rhDocumentTemplate.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, version: true } });
      if (!template) return null;
      return tx.rhDocumentTemplateVersion.findMany({
        where: { tenantId: access.tenantId, templateId: id },
        select: { id: true, version: true, name: true, type: true, createdAt: true, createdByUserId: true },
        orderBy: { version: 'desc' },
      });
    }, { userId: access.userId });
    if (!versions) return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
    return NextResponse.json(versions);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
