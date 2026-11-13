import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { runWithTenant } from '@/lib/tenant-db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const userId = getSessionUserId(session);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'Nome do fornecedor inválido.' }, { status: 400 });
  }
  const result = await runWithTenant(tenantId, async (tx) => {
    const existing = await tx.supplier.findFirst({ where: { id, tenantId } });
    if (!existing) return { notFound: true as const };
    const conflict = await tx.supplier.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' }, id: { not: id } }, select: { id: true } });
    if (conflict) return { code: 'NAME_EXISTS' as const };
    const supplier = await tx.supplier.update({
      where: { id },
      data: {
        name,
        nif: typeof body.nif === 'string' && body.nif.trim() ? body.nif.trim() : null,
        contact: typeof body.contact === 'string' && body.contact.trim() ? body.contact.trim() : null,
        address: typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null,
        email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null,
      },
    });
    return { supplier };
  }, { userId });

  if ('notFound' in result && result.notFound) return NextResponse.json({ error: 'Fornecedor não encontrado.' }, { status: 404 });
  if ('code' in result && result.code === 'NAME_EXISTS') return NextResponse.json({ code: 'NAME_EXISTS', error: 'Já existe outro fornecedor com este nome.' }, { status: 409 });
  return NextResponse.json(result.supplier);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  if (!tenantId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const userId = getSessionUserId(session);
  const { id } = await params;
  const result = await runWithTenant(tenantId, async (tx) => {
    const existing = await tx.supplier.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) return { notFound: true as const };
    const used = await tx.purchaseOrder.count({ where: { tenantId, supplierId: id } });
    if (used > 0) return { code: 'IN_USE' as const, used };
    await tx.supplier.delete({ where: { id } });
    return { ok: true as const };
  }, { userId });

  if ('notFound' in result && result.notFound) return NextResponse.json({ error: 'Fornecedor não encontrado.' }, { status: 404 });
  if ('code' in result && result.code === 'IN_USE') return NextResponse.json({ code: 'SUPPLIER_IN_USE', error: `Fornecedor tem ${result.used} encomenda(s) associada(s); não pode ser apagado.` }, { status: 409 });
  return NextResponse.json({ success: true });
}
