import { NextRequest, NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

    const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 160) : undefined;
    if (nome !== undefined && !nome) {
      return NextResponse.json({ error: 'Nome do produto é obrigatório' }, { status: 400 });
    }
    const preco = body.preco !== undefined ? Number(body.preco) : undefined;
    if (preco !== undefined && (!Number.isFinite(preco) || preco < 0)) {
      return NextResponse.json({ error: 'Preço inválido' }, { status: 400 });
    }
    const stock = body.stock !== undefined ? Number(body.stock) : undefined;
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      return NextResponse.json({ error: 'Stock inválido' }, { status: 400 });
    }
    const codigo = typeof body.codigo === 'string' ? body.codigo.trim().slice(0, 40) || 'SEM-COD' : undefined;
    const categoria = typeof body.categoria === 'string' ? body.categoria.trim().slice(0, 60) || 'GERAL' : undefined;
    const minStock = body.minStock !== undefined ? Number(body.minStock) : undefined;
    if (minStock !== undefined && (!Number.isInteger(minStock) || minStock < 0)) {
      return NextResponse.json({ error: 'Stock minimo invalido' }, { status: 400 });
    }

    const produto = await runWithTenant(tenantId, async (tx) => {
      const existing = await tx.product.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existing) return null;
      return tx.product.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { name: nome } : {}),
          ...(preco !== undefined ? { price: preco } : {}),
          ...(stock !== undefined ? { stock } : {}),
          ...(minStock !== undefined ? { minStock } : {}),
          ...(codigo !== undefined ? { codigo } : {}),
          ...(categoria !== undefined ? { categoria } : {}),
        },
      });
    }, { userId });
    if (!produto) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });

    return NextResponse.json({ success: true, id: produto.id, produto: { ...produto, price: Number(produto.price) } });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao actualizar o produto' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const { id } = await params;

    const result = await runWithTenant(tenantId, async (tx) => {
      const items = await tx.invoiceItem.count({ where: { productId: id, tenantId } });
      if (items > 0) return { conflict: items as number };
      const deleted = await tx.product.deleteMany({ where: { id, tenantId } });
      return { deleted: deleted.count as number };
    }, { userId });
    if ('conflict' in result) return NextResponse.json({ error: `Este produto já foi usado em ${result.conflict} linha(s) de factura e não pode ser apagado.` }, { status: 409 });
    if (!result.deleted) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao apagar o produto' }, { status: 500 });
  }
}