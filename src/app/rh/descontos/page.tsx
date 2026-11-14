import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { DeductionsList } from '@/components/rh/deductions-list';

export default async function RhDeductionsPage() {
  const access = await requireRhPage();
  const deductions = await runWithTenant(access.tenantId, (tx) => tx.rhEmployeeDeduction.findMany({
    where: { tenantId: access.tenantId },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  }), { userId: access.userId });

  return (
    <DeductionsList
      deductions={(deductions as any[]).map((d) => ({ ...d, amount: Number(d.amount) }))}
    />
  );
}
