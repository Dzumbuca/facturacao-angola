import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { NotificationsManager } from '@/components/rh/notifications-manager';

export default async function RhNotificationsPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const items = await tx.rhNotification.findMany({
      where: { tenantId: access.tenantId, userId: access.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unread = await tx.rhNotification.count({ where: { tenantId: access.tenantId, userId: access.userId, readAt: null } });
    return { items, unread };
  }, { userId: access.userId });

  return (
    <NotificationsManager
      items={(data.items as any[]).map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
      }))}
      unread={data.unread}
    />
  );
}