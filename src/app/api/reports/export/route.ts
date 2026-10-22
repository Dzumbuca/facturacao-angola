import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess } from '@/lib/tenant-api-access';
import { parseReportPeriod } from '@/lib/report-period';
import { getReportDataset, parseReportKind } from '@/lib/report-service';
import { exportReport } from '@/lib/report-export';

export async function GET(request: NextRequest) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const query = request.nextUrl.searchParams;
  const format = query.get('format');
  if (format !== 'pdf' && format !== 'xlsx' && format !== 'csv') return NextResponse.json({ error: 'Formato de exportação inválido.' }, { status: 400 });
  try {
    const period = parseReportPeriod({ period: query.get('period') ?? 'thisMonth', from: query.get('from'), to: query.get('to') });
    const dataset = await getReportDataset(tenantId, period, parseReportKind(query.get('kind')), query.get('customerId'), query.get('state'));
    const file = await exportReport(dataset, format);
    return new NextResponse(file.body as any, { headers: { 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${file.filename}"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Erro ao exportar relatório:', error);
    return NextResponse.json({ error: 'Não foi possível gerar o relatório.' }, { status: 500 });
  }
}
