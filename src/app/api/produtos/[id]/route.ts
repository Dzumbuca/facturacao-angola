import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';

type Context = { params: Promise<{ id: string }> };

// Editar um produto/serviço da empresa (isolado por tenant)
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const { id } = await params;

    const existing = await prisma.product.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });

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

    const produto = await prisma.product.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { name: nome } : {}),
        ...(preco !== undefined ? { price: preco } : {}),
        ...(stock !== undefined ? { stock } : {}),
        ...(codigo !== undefined ? { codigo } : {}),
        ...(categoria !== undefined ? { categoria } : {}),
      },
    });

    return NextResponse.json({ success: true, id: produto.id, produto: { ...produto, price: Number(produto.price) } });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao actualizar o produto' }, { status: 500 });
  }
}

// Apagar um produto — bloqueado quando já foi usado em facturas
export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const { id } = await params;

    const items = await prisma.invoiceItem.count({ where: { productId: id, tenantId } });
    if (items > 0) {
      return NextResponse.json({ error: `Este produto já foi usado em ${items} linha(s) de factura e não pode ser apagado.` }, { status: 409 });
    }

    const deleted = await prisma.product.deleteMany({ where: { id, tenantId } });
    if (deleted.count === 0) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao apagar o produto' }, { status: 500 });
  }
}
