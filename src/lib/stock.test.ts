import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from './prisma';

// Mock do prisma para testes isolados
vi.mock('./prisma', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    platformApplication: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

import {
  decrementStockForInvoice,
  restoreStockForCancelledInvoice,
  registerStockEntry,
  getLowStockAlerts,
  getStockValuationReport,
  getStockRotationReport,
} from './stock-service';

describe('stock-service', () => {
  const tenantId = 'tenant-test-123';
  const productId = 'product-test-456';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('decrementStockForInvoice', () => {
    it('decrementa stock e cria movimento OUT para cada item com produto', async () => {
      const mockProduct = { id: productId, stock: 100 };
      vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any);
      vi.mocked(prisma.product.update).mockResolvedValue({ ...mockProduct, stock: 90 } as any);
      vi.mocked(prisma.stockMovement.create).mockResolvedValue({} as any);

      await decrementStockForInvoice(tenantId, 'INV-001', [
        { productId, quantity: 10 },
      ]);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { stock: { decrement: 10 } },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          productId,
          type: 'OUT',
          quantity: 10,
          reason: 'Venda - fatura #INV-001',
          reference: 'INV-INV-001',
        },
      });
    });

    it('ignora itens sem productId ou quantidade zero', async () => {
      await decrementStockForInvoice(tenantId, 'INV-002', [
        { productId: null, quantity: 5 },
        { productId, quantity: 0 },
      ]);

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('restoreStockForCancelledInvoice', () => {
    it('incrementa stock e cria movimento IN para estorno', async () => {
      vi.mocked(prisma.product.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stockMovement.create).mockResolvedValue({} as any);

      await restoreStockForCancelledInvoice(tenantId, 'INV-003', [
        { productId, quantity: 5 },
      ]);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { stock: { increment: 5 } },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          productId,
          type: 'IN',
          quantity: 5,
          reason: 'Estorno - fatura anulada #INV-003',
          reference: 'INV-CANCEL-INV-003',
        },
      });
    });
  });

  describe('registerStockEntry', () => {
    it('registra entrada de estoque via compra', async () => {
      const mockProduct = { id: productId, stock: 50 };
      vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any);
      vi.mocked(prisma.product.update).mockResolvedValue({ ...mockProduct, stock: 70 } as any);
      vi.mocked(prisma.stockMovement.create).mockResolvedValue({} as any);

      const result = await registerStockEntry(tenantId, productId, 20, 'Compra fornecedor');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { stock: { increment: 20 } },
      });
      expect(result.product.stock).toBe(70);
    });

    it('lança erro quando produto nao encontrado', async () => {
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

      await expect(registerStockEntry(tenantId, 'inexistente', 10, 'Teste')).rejects.toThrow(
        'Produto nao encontrado'
      );
    });
  });

  describe('getLowStockAlerts', () => {
    it('lista produtos com stock zerado ou negativo', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Produto A', codigo: 'A001', stock: 0, minStock: 5, categoria: 'GERAL', price: 1000 },
      ];
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any);

      const result = await getLowStockAlerts(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Produto A');
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      const callArgs = (prisma.product.findMany as any).mock.calls[0][0];
      expect(callArgs.where).toEqual({ tenantId, stock: { lte: 0 } });
      expect(callArgs.orderBy).toEqual({ stock: 'asc' });
      expect(callArgs.select).toBeDefined();
    });
  });

  describe('getStockValuationReport', () => {
    it('calcula valor total do estoque', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Produto A', codigo: 'A001', stock: 10, price: 1000, categoria: 'GERAL' },
        { id: 'p2', name: 'Produto B', codigo: 'B002', stock: 5, price: 2000, categoria: 'GERAL' },
      ];
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any);

      const result = await getStockValuationReport(tenantId);

      expect(result.totalValue).toBe(10 * 1000 + 5 * 2000); // 20000
      expect(result.products[0].stockValue).toBe(10000);
      expect(result.products[1].stockValue).toBe(10000);
      expect(result.totalProducts).toBe(2);
    });
  });

  describe('getStockRotationReport', () => {
    it('lista produtos mais movimentados por saida', async () => {
      const now = new Date();
      const mockMovements = [
        { productId, product: { name: 'Produto X', codigo: 'X001' }, quantity: 10, createdAt: now },
        { productId, product: { name: 'Produto X', codigo: 'X001' }, quantity: 5, createdAt: now },
        { productId: 'other', product: { name: 'Produto Y', codigo: 'Y002' }, quantity: 3, createdAt: now },
      ];
      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue(mockMovements as any);

      const result = await getStockRotationReport(tenantId, 30);

      expect(result.length).toBe(2);
      expect(result[0].totalQuantity).toBe(15);
      expect(result[0].name).toBe('Produto X');
      expect(result[1].totalQuantity).toBe(3);
      expect(result[1].name).toBe('Produto Y');
    });
  });
});
