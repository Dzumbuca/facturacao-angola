import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const ROLES = ['ADMIN', 'MANAGER', 'FINANCE'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('members:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: 'Função inválida.' }, { status: 400 });

    const updated = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhMember.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
      if (!existing) return null;
      const row = await tx.rhMember.update({ where: { id }, data: { role: body.role } });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_MEMBER_UPDATED', entity: 'RhMember', entityId: id, metadata: { role: body.role } });
      return row;
    }, { userId: access.userId });

    if (!updated) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
