import { NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';
import { getCountLimitStatus } from '@/lib/entitlements';

function corrId() {
  return crypto.randomUUID().slice(0, 8);
}

function stepLog(cid: string, step: string, ms: number, result: string, code?: string) {
  console.error(`[customers:POST:${cid}] step=${step} durMs=${ms} result=${result}${code ? ` code=${code}` : ''}`);
}

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
  const cid = corrId();
  const t0 = performance.now();
  try {
    const access = await getTenantWriteAccess();
    const tAuth = performance.now();
    if (!access.ok) {
      stepLog(cid, 'auth', Math.round(tAuth - t0), 'access-denied');
      return NextResponse.json(access.body, { status: access.status });
    }
    stepLog(cid, 'auth', Math.round(tAuth - t0), 'ok');
    const { tenantId, userId } = access.access;
    const { name, nif, address, email } = await req.json();
    const tParse = performance.now();
    stepLog(cid, 'parse', Math.round(tParse - tAuth), 'ok');
    if (typeof name !== 'string' || !name.trim()) {
      stepLog(cid, 'validate', Math.round(performance.now() - tParse), 'invalid-name');
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    const result = await runWithTenant(tenantId, async (tx) => {
      const tTx = performance.now();
      // Serializa a criação por tenant para não ultrapassar o limite em corrida.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`customers:${tenantId}`}))`;
      const tLock = performance.now();
      stepLog(cid, 'advisory-lock', Math.round(tLock - tTx), 'ok');
      const used = await tx.customer.count({ where: { tenantId } });
      const tCount = performance.now();
      stepLog(cid, 'count-customers', Math.round(tCount - tLock), `used=${used}`);
      const status = await getCountLimitStatus(tx, tenantId, 'max_clients', used);
      const tLimit = performance.now();
      stepLog(cid, 'limit-check', Math.round(tLimit - tCount), status.allowed ? 'allowed' : `limit-reached used=${status.used} limit=${status.limit}`);
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
      const tCreate = performance.now();
      stepLog(cid, 'prisma-create', Math.round(tCreate - tLimit), `id=${customer.id.slice(0, 4)}`);
      return { limitReached: false as const, customer };
    }, { userId });
    const tTxDone = performance.now();
    stepLog(cid, 'transaction', Math.round(tTxDone - tParse), 'done');

    if (result.limitReached) {
      stepLog(cid, 'respond', Math.round(performance.now() - t0), '403-limit');
      return NextResponse.json(
        { code: 'LIMIT_REACHED', metric: 'max_clients', used: result.used, limit: result.limit, error: `O seu pacote permite ${result.limit} clientes.` },
        { status: 403 },
      );
    }

    stepLog(cid, 'respond', Math.round(performance.now() - t0), '200-ok');
    return NextResponse.json(result.customer);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    stepLog(cid, 'error', Math.round(performance.now() - t0), '500', code);
    console.error(`[customers:POST:${cid}] error message:`, (error as Error)?.message);
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 });
  }
}