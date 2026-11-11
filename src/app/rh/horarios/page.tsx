import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { ShiftsManager } from '@/components/rh/shifts-manager';

export default async function RhShiftsPage() {
  const access = await requireRhPage();
  const shifts = await runWithTenant(access.tenantId, (tx) => tx.rhShift.findMany({
    where: { tenantId: access.tenantId },
    include: { _count: { select: { employees: true } } },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  }), { userId: access.userId });
  return <ShiftsManager shifts={shifts as any} />;
}
