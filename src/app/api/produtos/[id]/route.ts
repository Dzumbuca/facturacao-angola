import { NextRequest, NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { isApplicationEnabled } from '@/lib/platform-apps';

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
    const codigo = typeof body.codigo === 'string' ? body.codigo.trim().slice(0, 40) : undefined;
    const categoria = typeof body.categoria === 'string' ? body.categoria.trim().slice(0, 60) || 'GERAL' : undefined;
    const minStock = body.minStock !== undefined ? Number(body.minStock) : undefined;
    if (minStock !== undefined && (!Number.isInteger(minStock) || minStock < 0)) {
      return NextResponse.json({ error: 'Stock minimo invalido' }, { status: 400 });
    }
    const barcode = typeof body.barcode === 'string' ? body.barcode.trim().slice(0, 64) || null : undefined;
    const purchasePrice = body.purchasePrice !== undefined && body.purchasePrice !== null && body.purchasePrice !== ''
      ? Number(body.purchasePrice)
      : undefined;
    if (purchasePrice !== undefined && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
      return NextResponse.json({ error: 'Preço de compra inválido' }, { status: 400 });
    }
    const subcategoria = typeof body.subcategoria === 'string' ? body.subcategoria.trim().slice(0, 60) || null : undefined;
    const marca = typeof body.marca === 'string' ? body.marca.trim().slice(0, 60) || null : undefined;
    const modelo = typeof body.modelo === 'string' ? body.modelo.trim().slice(0, 60) || null : undefined;
    const unidade = typeof body.unidade === 'string' ? body.unidade.trim().slice(0, 16) || 'un' : undefined;
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) || null : undefined;
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim().slice(0, 500) || null : undefined;

    // Catálogo gratuito não altera stock: exige módulo WMS.
    if (stock !== undefined || minStock !== undefined) {
      const wmsEnabled = await isApplicationEnabled(tenantId, 'wms');
      if (!wmsEnabled) {
        return NextResponse.json(
          { code: 'STOCK_REQUIRES_WMS', error: 'O controlo de stock faz parte dos pacotes pagos.' },
          { status: 403 },
        );
      }
    }

    const produto = await runWithTenant(tenantId, async (tx) => {
      const existing = await tx.product.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existing) return null;
      if (codigo !== undefined && codigo !== '') {
        const clash = await tx.product.findFirst({ where: { tenantId, codigo, id: { not: id } }, select: { id: true } });
        if (clash) return { code: 'SKU_DUPLICADO' };
      }
      if (barcode !== undefined && barcode !== null) {
        const clash = await tx.product.findFirst({ where: { tenantId, barcode, id: { not: id } }, select: { id: true } });
        if (clash) return { code: 'BARCODE_DUPLICADO' };
      }
      return tx.product.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { name: nome } : {}),
          ...(preco !== undefined ? { price: preco } : {}),
          ...(stock !== undefined ? { stock, trackStock: stock > 0 } : {}),
          ...(minStock !== undefined ? { minStock } : {}),
          ...(codigo !== undefined ? { codigo: codigo || null } : {}),
          ...(categoria !== undefined ? { categoria } : {}),
          ...(subcategoria !== undefined ? { subcategoria } : {}),
          ...(marca !== undefined ? { marca } : {}),
          ...(modelo !== undefined ? { modelo } : {}),
          ...(unidade !== undefined ? { unidade } : {}),
          ...(purchasePrice !== undefined ? { purchasePrice } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(barcode !== undefined ? { barcode } : {}),
        },
      });
    }, { userId });
    if (!produto) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    if (produto && 'code' in produto && (produto as any).code === 'SKU_DUPLICADO') return NextResponse.json({ error: 'Já existe um produto com este SKU.' }, { status: 409 });
    if (produto && 'code' in produto && (produto as any).code === 'BARCODE_DUPLICADO') return NextResponse.json({ error: 'Já existe um produto com este código de barras.' }, { status: 409 });

    return NextResponse.json({ success: true, id: produto.id, produto: { ...produto, price: Number(produto.price) } });
  } catch {
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
      const items = await tx.invoiceItem.count({ where: { productId: id, invoice: { tenantId } } });
      if (items > 0) return { conflict: items as number };
      const deleted = await tx.product.deleteMany({ where: { id, tenantId } });
      return { deleted: deleted.count as number };
    }, { userId });
    if ('conflict' in result) return NextResponse.json({ error: `Este produto já foi usado em ${result.conflict} linha(s) de factura e não pode ser apagado.` }, { status: 409 });
    if (!result.deleted) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao apagar o produto' }, { status: 500 });
  }
}