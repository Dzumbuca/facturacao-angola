import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';

type Context = { params: Promise<{ id: string }> };

// Actualizar um armazem
export async function PATCH(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });

  try {
    const warehouse = await runWithTenant(tenantId, async (tx) => {
      const existing = await tx.warehouse.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existing) {
        throw new Error('ARMAZEM_NAO_ENCONTRADO');
      }
      return tx.warehouse.update({
        where: { id },
        data: {
          ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
          ...(typeof body.location === 'string' ? { location: body.location.trim() } : {}),
          ...(typeof body.isDefault === 'boolean' ? { isDefault: body.isDefault } : {}),
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        },
      });
    });
    return NextResponse.json(warehouse);
  } catch (e: any) {
    if (e?.message === 'ARMAZEM_NAO_ENCONTRADO') {
      return NextResponse.json({ error: 'Armazem nao encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Apagar um armazem (apenas se nao houver produtos associados ao tenant que dependam dele).
// Nota: o modelo actual nao associa produtos directamente a armazens, pelo que a eliminacao
// e permitida desde que o armazem pertença ao tenant autenticado.
export async function DELETE(_request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const { id } = await params;

  try {
    await runWithTenant(tenantId, async (tx) => {
      const warehouse = await tx.warehouse.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!warehouse) {
        throw new Error('ARMAZEM_NAO_ENCONTRADO');
      }
      await tx.warehouse.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.message === 'ARMAZEM_NAO_ENCONTRADO') {
      return NextResponse.json({ error: 'Armazem nao encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
