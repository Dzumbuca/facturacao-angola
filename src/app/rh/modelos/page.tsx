import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { TemplatesManager } from '@/components/rh/templates-manager';

export default async function RhTemplatesPage() {
  const access = await requireRhAccess();
  const templates = await runWithTenant(access.tenantId, (tx) => tx.rhDocumentTemplate.findMany({
    where: { tenantId: access.tenantId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  }), { userId: access.userId });
  return <TemplatesManager templates={templates as any} />;
}
