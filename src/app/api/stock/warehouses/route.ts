import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { getWarehouseLimitStatus } from '@/lib/entitlements';

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

  const result = await runWithTenant(tenantId, async (tx) => {
    // Serializa a verificação de limite por tenant (evita ultrapassar em concorrência).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wms-warehouses:${tenantId}`}))`;
    const status = await getWarehouseLimitStatus(tx, tenantId);
    if (!status.allowed) return { limitReached: true as const, used: status.used, limit: status.limit };
    const warehouse = await tx.warehouse.create({ data: { tenantId, name, location, isDefault: !!isDefault } });
    return { limitReached: false as const, warehouse };
  }, { userId: getSessionUserId(session) });

  if (result.limitReached) {
    return NextResponse.json(
      {
        code: 'LIMIT_REACHED',
        metric: 'max_warehouses',
        used: result.used,
        limit: result.limit,
        error: `O seu pacote permite ${result.limit} armazém(ns).`,
      },
      { status: 403 },
    );
  }
  return NextResponse.json(result.warehouse, { status: 201 });
}
