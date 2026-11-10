import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { ShiftsManager } from '@/components/rh/shifts-manager';

export default async function RhShiftsPage() {
  const access = await requireRhAccess();
  const shifts = await runWithTenant(access.tenantId, (tx) => tx.rhShift.findMany({
    where: { tenantId: access.tenantId },
    include: { _count: { select: { employees: true } } },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  }), { userId: access.userId });
  return <ShiftsManager shifts={shifts as any} />;
}
