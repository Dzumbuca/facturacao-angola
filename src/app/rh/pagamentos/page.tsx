import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { PaymentsManager } from '@/components/rh/payments-manager';

export default async function RhPaymentsPage() {
  const access = await requireRhAccess();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [batches, runs] = await Promise.all([
      tx.rhPaymentBatch.findMany({
        where: { tenantId: access.tenantId },
        include: { run: { select: { period: true, status: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      tx.rhPayrollRun.findMany({
        where: { tenantId: access.tenantId, status: { in: ['APROVADO', 'PENDENTE_PAGAMENTO'] } },
        select: { id: true, period: true, totalNet: true },
        orderBy: { period: 'desc' },
      }),
    ]);
    return { batches, runs };
  }, { userId: access.userId });

  return (
    <PaymentsManager
      batches={(data.batches as any[]).map((batch) => ({ ...batch, total: Number(batch.total) }))}
      runs={(data.runs as any[]).map((run) => ({ ...run, totalNet: Number(run.totalNet) }))}
    />
  );
}
