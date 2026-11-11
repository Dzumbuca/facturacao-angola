import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { PositionsManager } from '@/components/rh/positions-manager';

export default async function RhPositionsPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [positions, departments] = await Promise.all([
      tx.rhPosition.findMany({
        where: { tenantId: access.tenantId },
        include: { department: { select: { id: true, name: true } }, _count: { select: { employees: true } } },
        orderBy: { title: 'asc' },
      }),
      tx.rhDepartment.findMany({ where: { tenantId: access.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { positions, departments };
  }, { userId: access.userId });
  return <PositionsManager positions={data.positions} departments={data.departments} />;
}
