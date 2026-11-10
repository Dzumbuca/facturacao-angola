import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { documentVariables, renderTemplate } from '@/lib/rh-documents';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhDocument.findMany({
      where: { tenantId: access.tenantId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } }, template: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }), { userId: access.userId });
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('documents:write');
    const body = await req.json().catch(() => ({}));
    const templateId = typeof body.templateId === 'string' ? body.templateId : '';
    const employeeId = typeof body.employeeId === 'string' && body.employeeId ? body.employeeId : null;
    if (!templateId) return NextResponse.json({ error: 'Modelo obrigatório.' }, { status: 400 });

    const created = await runWithTenant(access.tenantId, async (tx) => {
      const template = await tx.rhDocumentTemplate.findFirst({ where: { id: templateId, tenantId: access.tenantId, isActive: true } });
      if (!template) throw new Error('TEMPLATE_NOT_FOUND');
      let employee: any = null;
      if (employeeId) {
        employee = await tx.rhEmployee.findFirst({
          where: { id: employeeId, tenantId: access.tenantId },
          include: { position: { select: { title: true } }, department: { select: { name: true } } },
        });
        if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
      }
      const tenant = await tx.tenant.findUnique({ where: { id: access.tenantId }, select: { name: true, nif: true } });
      const content = renderTemplate(template.body, documentVariables(tenant ?? { name: '', nif: null }, employee));
      const row = await tx.rhDocument.create({
        data: {
          tenantId: access.tenantId,
          employeeId,
          templateId,
          type: template.type,
          title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : template.name,
          content,
          status: 'RASCUNHO',
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DOCUMENT_CREATED', entity: 'RhDocument', entityId: row.id, metadata: { templateId, employeeId } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'TEMPLATE_NOT_FOUND') return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
    if (error?.message === 'EMPLOYEE_NOT_FOUND') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
