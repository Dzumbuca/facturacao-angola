import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit-log';
import { generateAccountingExport } from '@/lib/accounting-report-xlsx';

export async function GET(req: NextRequest) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = (sp.get('type') ?? 'balancete') as 'diario' | 'razao' | 'balancete';
  const accountCode = sp.get('accountCode') ?? null;

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
  const tenantName = tenant?.name ?? 'Empresa';

  try {
    await logAuditEvent(tenantId, {
      action: 'REPORT_EXPORT_XLSX',
      entity: 'AccountingExport',
      entityId: type,
      source: '/api/contabilidade/export/xlsx?type=' + type,
      correlationId: req.headers.get('x-correlation-id') ?? undefined,
      after: { type, accountCode, format: 'xlsx' } as any,
    });
  } catch (err) { throw new Error('AUDIT_EVENT_FAILED: ' + String((err as any)?.message)); }

  const buffer = await generateAccountingExport(type, tenantId, tenantName, accountCode);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
