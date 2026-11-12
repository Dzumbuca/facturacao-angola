import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const onlyUnread = url.searchParams.get('unread') === '1';
    const [rows, unread] = await runWithTenant(access.tenantId, async (tx) => {
      const items = await tx.rhNotification.findMany({
        where: { tenantId: access.tenantId, userId: access.userId, ...(onlyUnread ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      const count = await tx.rhNotification.count({ where: { tenantId: access.tenantId, userId: access.userId, readAt: null } });
      return [items, count] as const;
    }, { userId: access.userId });
    return NextResponse.json({ unread, items: rows });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}