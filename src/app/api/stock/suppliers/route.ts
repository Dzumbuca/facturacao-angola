import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const suppliers = await runWithTenant(tenantId, async (tx) => {
    return tx.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, nif: true, email: true, phone: true } });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(suppliers);
}
