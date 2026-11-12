import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { PerformanceManager } from '@/components/rh/performance-manager';

export default async function RhPerformancePage() {
  const access = await requireRhPage();
  const cycles = (await runWithTenant(access.tenantId, async (tx) => {
    return tx.rhPerformanceCycle.findMany({
      where: { tenantId: access.tenantId },
      include: {
        criteria: { orderBy: { order: 'asc' } },
        reviews: {
          include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, position: { select: { title: true } } } } },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }, { userId: access.userId })) as any[];

  return (
    <PerformanceManager
      cycles={cycles.map((cycle) => ({
        ...cycle,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt ? cycle.endsAt.toISOString() : null,
        reviews: cycle.reviews.map((review: any) => ({ ...review, startsAt: undefined })),
      }))}
    />
  );
}