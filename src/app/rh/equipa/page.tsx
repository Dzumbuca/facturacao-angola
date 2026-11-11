import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { MembersManager } from '@/components/rh/members-manager';

export default async function RhMembersPage() {
  const access = await requireRhPage('members:write');
  const members = await runWithTenant(access.tenantId, (tx) => tx.rhMember.findMany({
    where: { tenantId: access.tenantId },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  }), { userId: access.userId });
  return <MembersManager members={members as any} />;
}
