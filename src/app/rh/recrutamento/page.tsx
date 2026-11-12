import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { RecruitmentManager } from '@/components/rh/recruitment-manager';

export default async function RhRecruitmentPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [openings, candidates, departments, positions] = await Promise.all([
      tx.rhJobOpening.findMany({
        where: { tenantId: access.tenantId },
        include: { department: { select: { name: true } }, position: { select: { title: true } }, _count: { select: { candidates: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      tx.rhCandidate.findMany({
        where: { tenantId: access.tenantId },
        include: { jobOpening: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      tx.rhDepartment.findMany({ where: { tenantId: access.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      tx.rhPosition.findMany({ where: { tenantId: access.tenantId }, select: { id: true, title: true }, orderBy: { title: 'asc' } }),
    ]);
    return { openings, candidates, departments, positions };
  }, { userId: access.userId });

  return (
    <RecruitmentManager
      openings={(data.openings as any[]).map((opening) => ({
        ...opening,
        closesAt: opening.closesAt ? opening.closesAt.toISOString() : null,
        departmentName: opening.department?.name ?? null,
        positionTitle: opening.position?.title ?? null,
        candidateCount: opening._count.candidates,
      }))}
      candidates={(data.candidates as any[]).map((candidate) => ({ ...candidate, openingTitle: candidate.jobOpening?.title ?? '—' }))}
      departments={data.departments}
      positions={data.positions}
    />
  );
}