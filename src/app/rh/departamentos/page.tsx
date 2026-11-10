import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { DepartmentsManager } from '@/components/rh/departments-manager';

export default async function RhDepartmentsPage() {
  const access = await requireRhAccess();
  const departments = await runWithTenant(access.tenantId, (tx) => tx.rhDepartment.findMany({
    where: { tenantId: access.tenantId },
    include: { _count: { select: { employees: true, positions: true, children: true } } },
    orderBy: { name: 'asc' },
  }), { userId: access.userId });
  return <DepartmentsManager departments={departments as any} />;
}
