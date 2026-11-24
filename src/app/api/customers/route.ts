import { NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';
import { getCountLimitStatus } from '@/lib/entitlements';

export async function GET() {
  try {
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const customers = await runWithTenant(tenantId, (tx) => tx.customer.findMany({ where: { tenantId } }), { userId });
    return NextResponse.json(customers);
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const { name, nif, address, email } = await req.json();
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    const result = await runWithTenant(tenantId, async (tx) => {
      // Serializa a criação por tenant para não ultrapassar o limite em corrida.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`customers:${tenantId}`}))`;
      const used = await tx.customer.count({ where: { tenantId } });
      const status = await getCountLimitStatus(tx, tenantId, 'max_clients', used);
      if (!status.allowed) return { limitReached: true as const, used: status.used, limit: status.limit };
      const customer = await tx.customer.create({
        data: {
          tenantId,
          name: name.trim(),
          nif,
          address,
          email,
        },
      });
      return { limitReached: false as const, customer };
    }, { userId });

    if (result.limitReached) {
      return NextResponse.json(
        { code: 'LIMIT_REACHED', metric: 'max_clients', used: result.used, limit: result.limit, error: `O seu pacote permite ${result.limit} clientes.` },
        { status: 403 },
      );
    }

    return NextResponse.json(result.customer);
  } catch {
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 });
  }
}