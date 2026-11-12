import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { TrainingManager } from '@/components/rh/training-manager';

export default async function RhTrainingPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [courses, employees, positions] = await Promise.all([
      tx.rhTrainingCourse.findMany({
        where: { tenantId: access.tenantId },
        include: { enrollments: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, position: { select: { title: true } } } } }, orderBy: { createdAt: 'desc' } } },
        orderBy: { startDate: 'desc' },
        take: 50,
      }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId, status: 'ACTIVO' }, select: { id: true, firstName: true, lastName: true, employeeNumber: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
      tx.rhPosition.findMany({ where: { tenantId: access.tenantId }, select: { id: true, title: true }, orderBy: { title: 'asc' } }),
    ]);
    return { courses, employees, positions };
  }, { userId: access.userId });

  return (
    <TrainingManager
      courses={(data.courses as any[]).map((course) => ({ ...course, startDate: course.startDate.toISOString(), endDate: course.endDate ? course.endDate.toISOString() : null }))}
      employees={data.employees}
      positions={data.positions}
    />
  );
}