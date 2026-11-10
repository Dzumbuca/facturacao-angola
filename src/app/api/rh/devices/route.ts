import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhDevice.findMany({
      where: { tenantId: access.tenantId },
      select: { id: true, name: true, isActive: true, lastSeenAt: true, createdAt: true },
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
    const access = await requireRhAccess('settings:write');
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) return NextResponse.json({ error: 'Nome do dispositivo inválido.' }, { status: 400 });

    const token = crypto.randomBytes(24).toString('base64url');
    const created = await runWithTenant(access.tenantId, async (tx) => {
      const row = await tx.rhDevice.create({
        data: { tenantId: access.tenantId, name, tokenHash: hashToken(token) },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DEVICE_CREATED', entity: 'RhDevice', entityId: row.id, metadata: { name } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json({ id: created.id, name: created.name, isActive: created.isActive, token }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um dispositivo com esse nome.' }, { status: 409 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
