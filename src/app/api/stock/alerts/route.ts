import { NextResponse } from 'next/server';
import { getTenantReadAccess } from '@/lib/tenant-api-access';
import { getLowStockAlerts } from '@/lib/stock-service';

export async function GET() {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;

  const alerts = await getLowStockAlerts(tenantId);

  return NextResponse.json({
    alerts,
    total: alerts.length,
    generatedAt: new Date().toISOString(),
  });
}
