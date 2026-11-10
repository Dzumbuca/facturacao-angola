import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('settings:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.isActive !== 'boolean') return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhDevice.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
      if (!existing) return null;
      const updated = await tx.rhDevice.update({ where: { id }, data: { isActive: body.isActive } });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DEVICE_UPDATED', entity: 'RhDevice', entityId: id, metadata: { isActive: body.isActive } });
      return updated;
    }, { userId: access.userId });

    if (!result) return NextResponse.json({ error: 'Dispositivo não encontrado.' }, { status: 404 });
    return NextResponse.json({ id: result.id, name: result.name, isActive: result.isActive });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
