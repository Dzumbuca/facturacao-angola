import { NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';
import { isApplicationEnabled } from '@/lib/platform-apps';

export async function GET(_req: Request) {
  try {
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;
    const produtos = await runWithTenant(tenantId, (tx) => tx.product.findMany({ where: { tenantId } }), { userId });
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
    const { codigo, nome, preco, stock, minStock, categoria } = await req.json();
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

    const produto: any = await runWithTenant(tenantId, (tx) => tx.product.create({
      data: {
        tenantId,
        name: nome.trim(),
        codigo: codigo || 'SEM-COD',
        price: Number(preco),
        stock: wmsEnabled && Number.isInteger(Number(stock)) && Number(stock) >= 0 ? Number(stock) : 0,
        minStock: wmsEnabled && Number.isInteger(Number(minStock)) && Number(minStock) >= 0 ? Number(minStock) : 0,
        trackStock: wmsEnabled && Number(stock) > 0,
        categoria: categoria || 'GERAL',
      },
    }), { userId });

    return NextResponse.json({
      success: true,
      id: produto.id,
      produto: { ...produto, price: Number(produto.price) },
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 });
  }
}