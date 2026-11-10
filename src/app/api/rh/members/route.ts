import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const ROLES = ['ADMIN', 'MANAGER', 'FINANCE'] as const;

export async function GET() {
  try {
    const access = await requireRhAccess('members:write');
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhMember.findMany({
      where: { tenantId: access.tenantId },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }), { userId: access.userId });
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('members:write');
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = ROLES.includes(body.role) ? body.role : null;
    if (!email) return NextResponse.json({ error: 'Email obrigatório.' }, { status: 400 });
    if (!role) return NextResponse.json({ error: 'Função inválida.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { tenantId: access.tenantId, email } , select: { id: true, email: true } });
      if (!user) return { code: 'USER_NOT_FOUND' as const };
      const member = await tx.rhMember.upsert({
        where: { tenantId_userId: { tenantId: access.tenantId, userId: user.id } },
        update: { role },
        create: { tenantId: access.tenantId, userId: user.id, role },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_MEMBER_UPSERTED', entity: 'RhMember', entityId: member.id, metadata: { userId: user.id, role } });
      return { code: 'OK' as const, member };
    }, { userId: access.userId });

    if (result.code === 'USER_NOT_FOUND') return NextResponse.json({ error: 'Utilizador não encontrado nesta empresa.' }, { status: 404 });
    return NextResponse.json(result.member, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
