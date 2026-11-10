import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { ContractsManager } from '@/components/rh/contracts-manager';

export default async function RhContractsPage() {
  const access = await requireRhAccess();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [contracts, employees] = await Promise.all([
      tx.rhContract.findMany({
        where: { tenantId: access.tenantId },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: { startDate: 'desc' },
        take: 200,
      }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId }, select: { id: true, firstName: true, lastName: true, employeeNumber: true }, orderBy: [{ firstName: 'asc' }] }),
    ]);
    return { contracts, employees };
  }, { userId: access.userId });

  return (
    <ContractsManager
      contracts={(data.contracts as any[]).map((contract) => ({
        ...contract,
        startDate: contract.startDate.toISOString(),
        endDate: contract.endDate ? contract.endDate.toISOString() : null,
        salary: Number(contract.salary),
      }))}
      employees={data.employees}
    />
  );
}
