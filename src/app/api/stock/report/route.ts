import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess } from '@/lib/tenant-api-access';
import { getStockValuationReport, getStockRotationReport } from '@/lib/stock-service';

export async function GET(req: NextRequest) {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  const valuation = await getStockValuationReport(tenantId);
  const rotation = await getStockRotationReport(tenantId, days);

  return NextResponse.json({
    valuation,
    rotation,
    periodDays: days,
    generatedAt: new Date().toISOString(),
  });
}
