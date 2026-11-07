import { NextRequest, NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';

type Context = { params: Promise<{ id: string }> };

const optionalText = (value: unknown, max: number): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, max) || null;
};

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : undefined;
    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    const customer = await runWithTenant(tenantId, async (tx) => {
      const existing = await tx.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existing) return null;
      return tx.customer.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(body.nif !== undefined ? { nif: optionalText(body.nif, 32) } : {}),
          ...(body.email !== undefined ? { email: optionalText(body.email, 254) } : {}),
          ...(body.address !== undefined ? { address: optionalText(body.address, 240) } : {}),
        },
      });
    }, { userId });
    if (!customer) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });

    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: 'Erro ao actualizar o cliente' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const { id } = await params;

    const result = await runWithTenant(tenantId, async (tx) => {
      const invoices = await tx.invoice.count({ where: { customerId: id, tenantId } });
      if (invoices > 0) return { conflict: invoices as number };
      const deleted = await tx.customer.deleteMany({ where: { id, tenantId } });
      return { deleted: deleted.count as number };
    }, { userId });
    if ('conflict' in result) return NextResponse.json({ error: `Este cliente tem ${result.conflict} factura(s) associada(s) e não pode ser apagado.` }, { status: 409 });
    if (!result.deleted) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao apagar o cliente' }, { status: 500 });
  }
}