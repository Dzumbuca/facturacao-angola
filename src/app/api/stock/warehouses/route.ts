import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const warehouses = await runWithTenant(tenantId, async (tx) => {
    return tx.warehouse.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  });
  return NextResponse.json(warehouses);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, location, isDefault } = body;
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

  const warehouse = await runWithTenant(tenantId, async (tx) => {
    return tx.warehouse.create({ data: { tenantId, name, location, isDefault: !!isDefault } });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(warehouse, { status: 201 });
}
