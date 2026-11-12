import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { JustificationsManager } from '@/components/rh/justifications-manager';

export default async function RhJustificationsPage() {
  const access = await requireRhPage();
  const items = await runWithTenant(access.tenantId, (tx) => tx.rhAbsenceJustification.findMany({
    where: { tenantId: access.tenantId },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
    orderBy: { date: 'desc' },
    take: 200,
  }), { userId: access.userId });

  return (
    <JustificationsManager
      items={(items as any[]).map((item) => ({ ...item, date: item.date.toISOString() }))}
    />
  );
}