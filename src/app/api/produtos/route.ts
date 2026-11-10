import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { getCountLimitStatus } from '@/lib/entitlements';

function generateSku(): string {
  return `SKU-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function normalizeOptional(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(_req: Request) {
  try {
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const produtos = await runWithTenant(tenantId, (tx) => tx.product.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    }), { userId });
    return NextResponse.json(produtos);
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const body = await req.json();
    const {
      codigo, nome, preco, stock, minStock, categoria, subcategoria, marca, modelo, unidade,
      purchasePrice, barcode, description, imageUrl,
    } = body;

    if (typeof nome !== 'string' || !nome.trim() || !Number.isFinite(Number(preco)) || Number(preco) < 0) {
      return NextResponse.json({ error: 'Nome e preço válidos são obrigatórios' }, { status: 400 });
    }

    // Catálogo gratuito não gere stock: stock/minStock exigem o módulo WMS.
    const stockInput = stock !== undefined && stock !== null && stock !== '';
    const minStockInput = minStock !== undefined && minStock !== null && minStock !== '';
    const wmsEnabled = stockInput || minStockInput ? await isApplicationEnabled(tenantId, 'wms') : false;
    if ((stockInput || minStockInput) && !wmsEnabled) {
      return NextResponse.json(
        { code: 'STOCK_REQUIRES_WMS', error: 'O controlo de stock faz parte dos pacotes pagos.' },
        { status: 403 },
      );
    }

    const purchaseValue = purchasePrice === '' || purchasePrice === undefined || purchasePrice === null
      ? null
      : Number(purchasePrice);
    if (purchaseValue !== null && (!Number.isFinite(purchaseValue) || purchaseValue < 0)) {
      return NextResponse.json({ error: 'Preço de compra inválido' }, { status: 400 });
    }

    const sku = normalizeOptional(codigo) ?? generateSku();
    const barcodeValue = normalizeOptional(barcode);
    const categoriaValue = normalizeOptional(categoria) ?? 'GERAL';

    const result = await runWithTenant(tenantId, async (tx) => {
      // Serializa a criação por tenant para não ultrapassar o limite em corrida.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`products:${tenantId}`}))`;
      const used = await tx.product.count({ where: { tenantId } });
      const status = await getCountLimitStatus(tx, tenantId, 'max_products', used);
      if (!status.allowed) return { limitReached: true as const, used: status.used, limit: status.limit };

      const skuClash = await tx.product.findFirst({ where: { tenantId, codigo: sku }, select: { id: true } });
      if (skuClash) return { code: 'SKU_DUPLICADO' as const };
      if (barcodeValue) {
        const barClash = await tx.product.findFirst({ where: { tenantId, barcode: barcodeValue }, select: { id: true } });
        if (barClash) return { code: 'BARCODE_DUPLICADO' as const };
      }

      const produto = await tx.product.create({
        data: {
          tenantId,
          name: nome.trim(),
          codigo: sku,
          barcode: barcodeValue,
          price: Number(preco),
          purchasePrice: purchaseValue,
          stock: wmsEnabled && Number.isInteger(Number(stock)) && Number(stock) >= 0 ? Number(stock) : 0,
          minStock: wmsEnabled && Number.isInteger(Number(minStock)) && Number(minStock) >= 0 ? Number(minStock) : 0,
          trackStock: wmsEnabled && Number(stock) > 0,
          categoria: categoriaValue,
          subcategoria: normalizeOptional(subcategoria),
          marca: normalizeOptional(marca),
          modelo: normalizeOptional(modelo),
          unidade: normalizeOptional(unidade) ?? 'un',
          description: normalizeOptional(description),
          imageUrl: normalizeOptional(imageUrl),
        },
      });
      return { limitReached: false as const, produto };
    }, { userId });

    if ('code' in result && result.code === 'SKU_DUPLICADO') {
      return NextResponse.json({ code: 'SKU_DUPLICADO', error: 'Já existe um produto com este SKU.' }, { status: 409 });
    }
    if ('code' in result && result.code === 'BARCODE_DUPLICADO') {
      return NextResponse.json({ code: 'BARCODE_DUPLICADO', error: 'Já existe um produto com este código de barras.' }, { status: 409 });
    }
    if ('limitReached' in result && result.limitReached) {
      return NextResponse.json(
        { code: 'LIMIT_REACHED', metric: 'max_products', used: result.used, limit: result.limit, error: `O seu pacote permite ${result.limit} produtos.` },
        { status: 403 },
      );
    }
    const produto: any = (result as { produto: any }).produto;

    return NextResponse.json({
      success: true,
      id: produto.id,
      produto: { ...produto, price: Number(produto.price) },
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 });
  }
}
