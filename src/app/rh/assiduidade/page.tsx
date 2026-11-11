import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { AttendanceManager } from '@/components/rh/attendance-manager';
import { lateMinutesFor } from '@/lib/rh-service';

export default async function RhAttendancePage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [entries, employees] = await Promise.all([
      tx.rhTimeEntry.findMany({
        where: { tenantId: access.tenantId, occurredAt: { gte: start, lte: end } },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, shift: { select: { name: true, startTime: true, toleranceMinutes: true } } } } },
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

  const now = new Date();
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><a href={`/api/rh/export/attendance?from=${monthFrom}&to=${monthTo}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] bg-white px-3 text-xs font-semibold text-[#021f87]">Exportar CSV (mês)</a></div>
      <AttendanceManager
        entries={(data.entries as any[]).map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString(), lateMinutes: entry.type === 'ENTRADA' ? lateMinutesFor(entry.occurredAt, entry.employee.shift) : 0, shiftName: entry.employee.shift?.name ?? null }))}
        employees={(data.employees as any[]).map(({ pinHash, ...employee }) => ({ ...employee, hasPin: Boolean(pinHash) }))}
      />
    </div>
  );
}
