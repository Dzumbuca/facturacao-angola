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
      <div className="flex justify-end"><a href={`/api/rh/export/attendance?from=${monthFrom}&to=${monthTo}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e1e8f0] bg-white px-3 text-xs font-semibold text-[#1c2d3f] transition hover:border-[#021f87] hover:text-[#021f87]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width={14} height={14} aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v3h16v-3"/></svg>Exportar CSV (mês)</a></div>
      <AttendanceManager
        entries={(data.entries as any[]).map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString(), lateMinutes: entry.type === 'ENTRADA' ? lateMinutesFor(entry.occurredAt, entry.employee.shift) : 0, shiftName: entry.employee.shift?.name ?? null }))}
        employees={(data.employees as any[]).map(({ pinHash, ...employee }) => ({ ...employee, hasPin: Boolean(pinHash) }))}
      />
    </div>
  );
}
