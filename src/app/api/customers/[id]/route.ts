import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';

type Context = { params: Promise<{ id: string }> };

const optionalText = (value: unknown, max: number): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, max) || null;
};

// Editar um cliente da empresa (isolado por tenant)
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const { id } = await params;

    const existing = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : undefined;
    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(body.nif !== undefined ? { nif: optionalText(body.nif, 32) } : {}),
        ...(body.email !== undefined ? { email: optionalText(body.email, 254) } : {}),
        ...(body.address !== undefined ? { address: optionalText(body.address, 240) } : {}),
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao actualizar o cliente' }, { status: 500 });
  }
}

// Apagar um cliente — bloqueado quando tem facturas associadas
export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const { id } = await params;

    const invoices = await prisma.invoice.count({ where: { customerId: id, tenantId } });
    if (invoices > 0) {
      return NextResponse.json({ error: `Este cliente tem ${invoices} factura(s) associada(s) e não pode ser apagado.` }, { status: 409 });
    }

    const deleted = await prisma.customer.deleteMany({ where: { id, tenantId } });
    if (deleted.count === 0) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao apagar o cliente' }, { status: 500 });
  }
}
