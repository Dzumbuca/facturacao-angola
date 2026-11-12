import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';
import { getCountLimitStatus } from '@/lib/entitlements';

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const suppliers = await runWithTenant(tenantId, async (tx) => {
    return tx.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, nif: true, email: true, phone: true } });
  }, { userId: getSessionUserId(session) });
  return NextResponse.json(suppliers);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = getSessionUserId(session);

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'Nome do fornecedor inválido (máx. 200 caracteres).' }, { status: 400 });
  }

  const result = await runWithTenant(tenantId, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suppliers:${tenantId}`}))`;
    const used = await tx.supplier.count({ where: { tenantId } });
    const status = await getCountLimitStatus(tx, tenantId, 'max_suppliers', used);
    if (!status.allowed) return { limitReached: true as const, used: status.used, limit: status.limit };

    const existing = await tx.supplier.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
    if (existing) return { code: 'NAME_EXISTS' as const };

    const supplier = await tx.supplier.create({
      data: {
        tenantId,
        name,
        nif: typeof body.nif === 'string' && body.nif.trim() ? body.nif.trim().slice(0, 50) : null,
        contact: typeof body.contact === 'string' && body.contact.trim() ? body.contact.trim().slice(0, 200) : null,
        address: typeof body.address === 'string' && body.address.trim() ? body.address.trim().slice(0, 300) : null,
        email: typeof body.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 200) : null,
      },
    });
    return { limitReached: false as const, supplier };
  }, { userId });

  if ('code' in result && result.code === 'NAME_EXISTS') {
    return NextResponse.json({ code: 'NAME_EXISTS', error: 'Fornecedor já registado com este nome.' }, { status: 409 });
  }
  if ('limitReached' in result && result.limitReached) {
    return NextResponse.json(
      { code: 'LIMIT_REACHED', metric: 'max_suppliers', used: result.used, limit: result.limit, error: `O seu pacote permite ${result.limit} fornecedores.` },
      { status: 403 },
    );
  }
  return NextResponse.json((result as any).supplier, { status: 201 });
}
