import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { AnnouncementsManager } from '@/components/rh/announcements-manager';

export default async function RhAnnouncementsPage() {
  const access = await requireRhPage();
  const items = await runWithTenant(access.tenantId, (tx) => tx.rhAnnouncement.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  }), { userId: access.userId });

  return (
    <AnnouncementsManager
      items={(items as any[]).map((item) => ({ ...item, publishedAt: item.publishedAt.toISOString(), expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null }))}
    />
  );
}