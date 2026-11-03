import { prisma } from './prisma';
import { runWithTenant } from './tenant-db';

/**
 * Dá baixa automática no estoque quando uma fatura e emitida.
 * Decrementa o stock de cada produto nos itens da fatura e registra
 * movimentos de tipo OUT com referencia da fatura.
 */
export async function decrementStockForInvoice(
  tenantId: string,
  invoiceId: string,
  items: Array<{ productId: string | null; quantity: number }>,
  tx?: any
): Promise<void> {
  const database = tx || prisma;

  const stockMovements = items
    .filter((item) => item.productId && item.quantity > 0)
    .map((item) => ({
      productId: item.productId!,
      quantity: item.quantity,
      description: `Baixa por fatura #${invoiceId}`,
    }));

  for (const movement of stockMovements) {
    const product = await database.product.findFirst({
      where: { id: movement.productId, tenantId },
      select: { id: true, stock: true },
    });
    if (!product) continue;

    await database.product.update({
      where: { id: product.id },
      data: { stock: { decrement: movement.quantity } },
    });

    await database.stockMovement.create({
      data: {
        tenantId,
        productId: product.id,
        type: 'OUT',
        quantity: movement.quantity,
        reason: `Venda - fatura #${invoiceId}`,
        reference: `INV-${invoiceId}`,
      },
    });
  }
}

/**
 * Restaura estoque quando uma fatura e anulada (Nota de Credito).
 * Incrementa o stock dos produtos e registra movimentos de tipo IN.
 */
export async function restoreStockForCancelledInvoice(
  tenantId: string,
  invoiceId: string,
  items: Array<{ productId: string | null; quantity: number }>,
  tx?: any
): Promise<void> {
  const database = tx || prisma;

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;

    await database.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });

    await database.stockMovement.create({
      data: {
        tenantId,
        productId: item.productId,
        type: 'IN',
        quantity: item.quantity,
        reason: `Estorno - fatura anulada #${invoiceId}`,
        reference: `INV-CANCEL-${invoiceId}`,
      },
    });
  }
}

/**
 * Registra entrada de estoque via compra/fornecedor.
 * Incrementa o stock do produto e cria movimento tipo IN.
 */
export async function registerStockEntry(
  tenantId: string,
  productId: string,
  quantity: number,
  reason: string,
  reference?: string,
  createdByUserId?: string
) {
  return runWithTenant(tenantId, async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new Error('Produto nao encontrado');

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });

    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        productId,
        type: 'IN',
        quantity,
        reason,
        reference,
        createdByUserId,
      },
    });

    return { product: updated, movement };
  });
}

/**
 * Lista produtos com stock abaixo do minimo (alertas de estoque baixo).
 */
export async function getLowStockAlerts(tenantId: string) {
  return prisma.product.findMany({
    where: {
      tenantId,
      stock: { lte: 0 }, // stock zerado ou negativo
    },
    orderBy: { stock: 'asc' },
    select: {
      id: true,
      name: true,
      codigo: true,
      stock: true,
      minStock: true,
      categoria: true,
      price: true,
    },
  });
}

/**
 * Relatório de valorizacao do estoque (quantidade * preco).
 */
export async function getStockValuationReport(tenantId: string) {
  const products = await prisma.product.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      codigo: true,
      stock: true,
      price: true,
      categoria: true,
    },
  });

  const totalValue = products.reduce(
    (sum: number, p: { stock: number; price: string | number }) =>
      sum + (p.stock || 0) * Number(p.price),
    0
  );

  return {
    products: products.map((p: { stock: number; price: string | number; name: string; codigo: string; categoria: string | null }) => ({
      ...p,
      stockValue: (p.stock || 0) * Number(p.price),
    })),
    totalValue,
    totalProducts: products.length,
  };
}

/**
 * Relatório de rotacao: produtos mais movimentados (saidas) no periodo.
 */
export async function getStockRotationReport(
  tenantId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const movements = await prisma.stockMovement.findMany({
    where: {
      tenantId,
      type: 'OUT',
      createdAt: { gte: startDate },
    },
    include: {
      product: { select: { name: true, codigo: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rotationByProduct = movements.reduce(
  (
    acc: Map<string, { name: string; codigo: string | null; totalQuantity: number; movements: number }>,
    m: { productId: string; quantity: number; product: { name: string; codigo: string | null } | null }
  ) => {
    if (!m.product) return acc;
    const key = m.productId;
    const existing = acc.get(key);
    if (existing) {
      existing.totalQuantity += m.quantity;
      existing.movements += 1;
    } else {
      acc.set(key, {
        name: m.product.name,
        codigo: m.product.codigo,
        totalQuantity: m.quantity,
        movements: 1,
      });
    }
    return acc;
  },
  new Map<string, { name: string; codigo: string | null; totalQuantity: number; movements: number }>()
);

  const entries = Array.from(rotationByProduct.entries()) as [string, { name: string; codigo: string | null; totalQuantity: number; movements: number }][];
  return entries
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
}
