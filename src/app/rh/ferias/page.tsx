import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { LeavesManager } from '@/components/rh/leaves-manager';

export default async function RhLeavesPage() {
  const access = await requireRhPage();
  const year = new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [leaves, employees, settings] = await Promise.all([
      tx.rhLeaveRequest.findMany({
        where: { tenantId: access.tenantId, startDate: { gte: start, lt: end } },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: { startDate: 'desc' },
        take: 300,
      }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId, status: 'ACTIVO' }, select: { id: true, firstName: true, lastName: true, employeeNumber: true }, orderBy: [{ firstName: 'asc' }] }),
      tx.rhSettings.findUnique({ where: { tenantId: access.tenantId } }),
    ]);
    return { leaves, employees, settings };
  }, { userId: access.userId });

  return (
    <LeavesManager
      leaves={(data.leaves as any[]).map((leave) => ({ ...leave, startDate: leave.startDate.toISOString(), endDate: leave.endDate.toISOString() }))}
      employees={data.employees as any}
      vacationDaysPerYear={data.settings?.vacationDaysPerYear ?? null}
    />
  );
}
