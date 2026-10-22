import { NextRequest, NextResponse } from 'next/server';
import { generateSAFTAO } from '@/lib/saft-ao';
import { getTenantReadAccess } from '@/lib/tenant-api-access';
import { getSAFTPeriod } from '@/lib/saft-period';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    let period: { month: number; year: number };
    try {
      period = getSAFTPeriod(searchParams.get('month'), searchParams.get('year'));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Período inválido' }, { status: 400 });
    }

    const xml = await generateSAFTAO(tenantId, period.month, period.year);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="SAFT_${period.year}_${period.month}.xml"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar SAFT:', error);
    return NextResponse.json({ error: 'Erro ao gerar SAFT' }, { status: 500 });
  }
}
