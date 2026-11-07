import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const products = await runWithTenant(tenantId, async (tx) => tx.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, codigo: true, stock: true, minStock: true, categoria: true } }), { userId: getSessionUserId(session) });
  return NextResponse.json(products);
}
