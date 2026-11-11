import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { DocumentsManager } from '@/components/rh/documents-manager';

export default async function RhDocumentsPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [documents, templates, employees] = await Promise.all([
      tx.rhDocument.findMany({
        where: { tenantId: access.tenantId },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      tx.rhDocumentTemplate.findMany({ where: { tenantId: access.tenantId, isActive: true }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId, status: 'ACTIVO' }, select: { id: true, firstName: true, lastName: true, employeeNumber: true }, orderBy: [{ firstName: 'asc' }] }),
    ]);
    return { documents, templates, employees };
  }, { userId: access.userId });

  return (
    <DocumentsManager
      documents={(data.documents as any[]).map((document) => ({ ...document, createdAt: document.createdAt.toISOString() }))}
      templates={data.templates as any}
      employees={data.employees as any}
    />
  );
}
