import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { PayrollManager } from '@/components/rh/payroll-manager';

export default async function RhPayrollPage() {
  const access = await requireRhAccess();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [rulesets, runs] = await Promise.all([
      tx.rhPayrollRuleSet.findMany({ where: { tenantId: access.tenantId }, orderBy: { effectiveFrom: 'desc' } }),
      tx.rhPayrollRun.findMany({
        where: { tenantId: access.tenantId },
        include: { ruleset: { select: { name: true } }, _count: { select: { payslips: true } } },
        orderBy: { period: 'desc' },
        take: 100,
      }),
    ]);
    return { rulesets, runs };
  }, { userId: access.userId });

  return (
    <PayrollManager
      rulesets={(data.rulesets as any[]).map((ruleset) => ({ ...ruleset, effectiveFrom: ruleset.effectiveFrom.toISOString() }))}
      runs={(data.runs as any[]).map((run) => ({
        ...run,
        totalGross: Number(run.totalGross), totalNet: Number(run.totalNet),
        totalInss: Number(run.totalInss), totalIrt: Number(run.totalIrt),
      }))}
    />
  );
}
