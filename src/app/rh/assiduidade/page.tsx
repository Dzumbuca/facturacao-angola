import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { AttendanceManager } from '@/components/rh/attendance-manager';

export default async function RhAttendancePage() {
  const access = await requireRhAccess();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [entries, employees] = await Promise.all([
      tx.rhTimeEntry.findMany({
        where: { tenantId: access.tenantId, occurredAt: { gte: start, lte: end } },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: { occurredAt: 'desc' },
        take: 300,
      }),
      tx.rhEmployee.findMany({
        where: { tenantId: access.tenantId, status: 'ACTIVO' },
        select: { id: true, firstName: true, lastName: true, employeeNumber: true, pinHash: true },
        orderBy: [{ firstName: 'asc' }],
      }),
    ]);
    return { entries, employees };
  }, { userId: access.userId });

  return (
    <AttendanceManager
      entries={(data.entries as any[]).map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString() }))}
      employees={(data.employees as any[]).map(({ pinHash, ...employee }) => ({ ...employee, hasPin: Boolean(pinHash) }))}
    />
  );
}
