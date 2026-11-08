import { runWithTenant } from './tenant-db';
import type { ReportDataset, StockReportKind } from './report-data';
import type { ReportPeriod } from './report-period';

export class StockReportsUnavailableError extends Error {
  constructor() {
    super('Os relatórios de armazém exigem o módulo WMS activo.');
    this.name = 'StockReportsUnavailableError';
  }
}

const TITLES: Record<StockReportKind, string> = {
  stock_balances: 'Posição de stock por armazém',
  stock_movements: 'Movimentos de stock',
  stock_low: 'Produtos abaixo do stock mínimo',
  stock_transfers: 'Transferências entre armazéns',
  stock_valuation: 'Valorização do inventário',
};

const MOVEMENT_TYPES: Record<string, string> = {
  IN: 'Entrada', OUT: 'Saída', ADJUSTMENT: 'Ajuste', TRANSFER: 'Transferência',
};

const TRANSFER_STATES: Record<string, string> = {
  PENDING: 'Pendente', IN_TRANSIT: 'Em trânsito', RECEIVED: 'Recebida', CANCELLED: 'Cancelada',
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const date = (value: Date) => value.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' });
const dateTime = (value: Date) => value.toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' });

export async function buildStockReportDataset(params: {
  tenantId: string;
  kind: StockReportKind;
  period: ReportPeriod;
  warehouseId?: string | null;
  productId?: string | null;
}): Promise<ReportDataset> {
  const { tenantId, kind, period } = params;
  const warehouseId = params.warehouseId || null;
  const productId = params.productId || null;
  const now = new Date();

  return runWithTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, nif: true } });
    const company = { name: tenant?.name ?? '', nif: tenant?.nif ?? null };
    let headers: string[] = [];
    let rows: (string | number | null)[][] = [];

    if (kind === 'stock_balances') {
      const balances = await tx.productWarehouseStock.findMany({
        where: { tenantId, ...(warehouseId ? { warehouseId } : {}), ...(productId ? { productId } : {}) },
        include: {
          product: { select: { name: true, codigo: true, price: true, minStock: true } },
          warehouse: { select: { name: true } },
          lot: { select: { lotNumber: true } },
        },
        orderBy: { product: { name: 'asc' } },
        take: 5000,
      });
      headers = ['Produto', 'Código', 'Armazém', 'Lote', 'Quantidade', 'Valor de venda (AOA)', 'Estado'];
      rows = balances.map((row: any) => {
        const quantity = Number(row.quantity);
        return [
          row.product.name, row.product.codigo ?? '', row.warehouse.name, row.lot?.lotNumber ?? '—',
          quantity, round(quantity * Number(row.product.price)),
          quantity <= Number(row.product.minStock) ? 'Abaixo do mínimo' : 'Normal',
        ];
      });
    } else if (kind === 'stock_movements') {
      const movements = await tx.stockMovement.findMany({
        where: {
          tenantId,
          createdAt: { gte: period.start, lt: period.endExclusive },
          ...(warehouseId ? { warehouseId } : {}),
          ...(productId ? { productId } : {}),
        },
        include: { product: { select: { name: true, codigo: true } }, warehouse: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      headers = ['Data', 'Tipo', 'Produto', 'Armazém', 'Quantidade', 'Motivo', 'Referência'];
      rows = movements.map((row: any) => [
        dateTime(row.createdAt), MOVEMENT_TYPES[row.type] ?? row.type, row.product?.name ?? '—',
        row.warehouse?.name ?? '—', Number(row.quantitySigned ?? row.quantity), row.reason ?? '', row.reference ?? '',
      ]);
    } else if (kind === 'stock_low') {
      const products = await tx.product.findMany({
        where: { tenantId, minStock: { gt: 0 }, ...(productId ? { id: productId } : {}) },
        select: { name: true, codigo: true, stock: true, minStock: true },
        orderBy: { name: 'asc' },
      });
      const low = products.filter((product: any) => Number(product.stock) <= Number(product.minStock));
      headers = ['Produto', 'Código', 'Stock actual', 'Stock mínimo', 'Falta'];
      rows = low.map((product: any) => [
        product.name, product.codigo ?? '', Number(product.stock), Number(product.minStock),
        round(Math.max(0, Number(product.minStock) - Number(product.stock))),
      ]);
    } else if (kind === 'stock_transfers') {
      const transfers = await tx.stockTransfer.findMany({
        where: {
          tenantId,
          createdAt: { gte: period.start, lt: period.endExclusive },
          ...(warehouseId ? { OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }] } : {}),
        },
        include: { fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, items: { select: { quantity: true } } },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });
      headers = ['Data', 'Referência', 'Origem', 'Destino', 'Estado', 'Linhas', 'Quantidade total'];
      rows = transfers.map((row: any) => [
        date(row.createdAt), row.reference ?? '', row.fromWarehouse?.name ?? '—', row.toWarehouse?.name ?? '—',
        TRANSFER_STATES[row.status] ?? row.status, row.items.length,
        round(row.items.reduce((sum: number, item: any) => sum + Number(item.quantity), 0)),
      ]);
    } else {
      const products = await tx.product.findMany({
        where: { tenantId, ...(productId ? { id: productId } : {}) },
        select: { name: true, codigo: true, categoria: true, stock: true, price: true },
        orderBy: { name: 'asc' },
      });
      headers = ['Produto', 'Código', 'Categoria', 'Quantidade', 'Preço (AOA)', 'Valor de venda (AOA)'];
      rows = products.map((product: any) => [
        product.name, product.codigo ?? '', product.categoria, Number(product.stock), Number(product.price),
        round(Number(product.stock) * Number(product.price)),
      ]);
    }

    const totals = headers.map((_, index) => {
      if (index === 0) return 'TOTAL';
      const sum = rows.reduce((total, row) => total + (typeof row[index] === 'number' ? row[index] as number : 0), 0);
      return sum || null;
    });

    return {
      kind,
      title: TITLES[kind],
      company,
      period,
      generatedAt: now,
      filters: { customerId: null, state: null, warehouseId, productId },
      headers,
      rows,
      totals,
    };
  });
}
