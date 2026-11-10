import { NextResponse } from 'next/server';
import { getTenantReadAccess } from '@/lib/tenant-api-access';
import { runWithTenant } from '@/lib/tenant-db';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parseIntParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: Request) {
  try {
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId, userId } = access.access;

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const sku = (url.searchParams.get('sku') ?? '').trim();
    const barcode = (url.searchParams.get('barcode') ?? '').trim();
    const categoria = (url.searchParams.get('categoria') ?? '').trim();
    const marca = (url.searchParams.get('marca') ?? '').trim();
    const modelo = (url.searchParams.get('modelo') ?? '').trim();
    const warehouseId = (url.searchParams.get('warehouseId') ?? '').trim();

    const page = parseIntParam(url.searchParams.get('page'), 1);
    const limit = Math.min(MAX_LIMIT, parseIntParam(url.searchParams.get('limit'), DEFAULT_LIMIT));

    const sortRaw = url.searchParams.get('sort') ?? 'name';
    const dirRaw = url.searchParams.get('dir') ?? 'asc';
    const dir = dirRaw === 'desc' ? 'desc' : 'asc';
    const orderBy: Record<string, string> = {};
    const allowedSort: Record<string, string> = { name: 'name', codigo: 'codigo', stock: 'stock', price: 'price', createdAt: 'createdAt' };
    orderBy[allowedSort[sortRaw] ?? 'name'] = dir;

    const where: any = { tenantId };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { codigo: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { categoria: { contains: q, mode: 'insensitive' } },
        { marca: { contains: q, mode: 'insensitive' } },
        { modelo: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (sku) where.codigo = { contains: sku, mode: 'insensitive' };
    if (barcode) where.barcode = { contains: barcode, mode: 'insensitive' };
    if (categoria) where.categoria = { equals: categoria, mode: 'insensitive' };
    if (marca) where.marca = { equals: marca, mode: 'insensitive' };
    if (modelo) where.modelo = { contains: modelo, mode: 'insensitive' };

    const result = await runWithTenant(tenantId, async (tx) => {
      const total = await tx.product.count({ where });
      const rows = await tx.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: warehouseId
          ? { warehouseStocks: { where: { warehouseId }, select: { quantity: true, lotId: true } } }
          : undefined,
      });
      return { total, rows };
    }, { userId });

    const items = result.rows.map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      name: p.name,
      barcode: p.barcode,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      marca: p.marca,
      modelo: p.modelo,
      unidade: p.unidade,
      price: Number(p.price),
      purchasePrice: p.purchasePrice == null ? null : Number(p.purchasePrice),
      stock: Number(p.stock),
      minStock: Number(p.minStock),
      availableInWarehouse: warehouseId
        ? (p.warehouseStocks ?? []).filter((w: any) => w.lotId == null).reduce((sum: number, w: any) => sum + Number(w.quantity ?? 0), 0)
        : null,
    }));

    return NextResponse.json({
      items,
      total: result.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao pesquisar produtos' }, { status: 500 });
  }
}
