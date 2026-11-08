import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReportPeriod } from './report-period';

const state = vi.hoisted(() => ({ tx: null as any }));
vi.mock('./tenant-db', () => ({
  runWithTenant: vi.fn(async (_tenantId: string, fn: (tx: any) => Promise<any>) => fn(state.tx)),
}));

import { buildStockReportDataset } from './stock-report-service';
import { parseReportPeriod } from './report-period';

const period: ReportPeriod = parseReportPeriod({ period: 'thisMonth' }, new Date('2026-11-15T12:00:00Z'));

function baseTx() {
  return { tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Empresa E2E', nif: '500000001' }) } };
}

describe('stock-report-service', () => {
  beforeEach(() => { state.tx = null; });

  it('posição de stock calcula valor e estado mínimo', async () => {
    state.tx = {
      ...baseTx(),
      productWarehouseStock: {
        findMany: vi.fn().mockResolvedValue([{
          quantity: 2,
          product: { name: 'Produto A', codigo: 'A1', price: 100, minStock: 5 },
          warehouse: { name: 'Armazém A' },
          lot: null,
        }]),
      },
    };
    const dataset = await buildStockReportDataset({ tenantId: 't1', kind: 'stock_balances', period });
    expect(dataset.title).toBe('Posição de stock por armazém');
    expect(dataset.rows[0]).toEqual(['Produto A', 'A1', 'Armazém A', '—', 2, 200, 'Abaixo do mínimo']);
    expect(dataset.totals[4]).toBe(2);
    expect(dataset.totals[5]).toBe(200);
  });

  it('abaixo do mínimo só lista produtos com minStock > 0 e stock <= mínimo', async () => {
    state.tx = {
      ...baseTx(),
      product: {
        findMany: vi.fn().mockResolvedValue([
          { name: 'A', codigo: 'A1', stock: 2, minStock: 5 },
          { name: 'B', codigo: 'B1', stock: 10, minStock: 5 },
        ]),
      },
    };
    const dataset = await buildStockReportDataset({ tenantId: 't1', kind: 'stock_low', period });
    expect(dataset.rows).toEqual([['A', 'A1', 2, 5, 3]]);
    expect(dataset.totals[4]).toBe(3);
  });

  it('movimentos mapeia tipos e referências', async () => {
    state.tx = {
      ...baseTx(),
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([{
          createdAt: new Date('2026-11-10T10:00:00Z'),
          type: 'IN',
          quantity: 4,
          quantitySigned: 4,
          reason: 'Compra',
          reference: 'PO-1',
          product: { name: 'Produto A', codigo: 'A1' },
          warehouse: { name: 'Armazém A' },
        }]),
      },
    };
    const dataset = await buildStockReportDataset({ tenantId: 't1', kind: 'stock_movements', period });
    expect(dataset.rows[0][1]).toBe('Entrada');
    expect(dataset.rows[0][4]).toBe(4);
    expect(dataset.rows[0][6]).toBe('PO-1');
  });
});
