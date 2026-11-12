import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') as string[] : null;

    const updated = (await runWithTenant(access.tenantId, (tx) => tx.rhNotification.updateMany({
      where: { tenantId: access.tenantId, userId: access.userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    }), { userId: access.userId })) as { count: number };

    return NextResponse.json({ updated: updated.count });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}