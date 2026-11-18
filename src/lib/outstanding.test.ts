import { describe, it, expect } from 'vitest';
import { aggregateOutstandingByCustomer, aggregateOutstandingBySupplier } from './outstanding';

describe('aggregateOutstandingByCustomer', () => {
  it('agrega saldo por cliente', () => {
    const map = aggregateOutstandingByCustomer([
      { customerId: 'A', total: 100, payments: [{ amount: 40, status: 'CONFIRMED' }] },
      { customerId: 'A', total: 80, payments: [{ amount: 80, status: 'CONFIRMED' }] },
      { customerId: 'B', total: 50, payments: [] },
    ]);
    expect(map.get('A')).toBe(60);
    expect(map.get('B')).toBe(50);
  });
  it('ignora facturas sem saldo em dívida', () => {
    const map = aggregateOutstandingByCustomer([
      { customerId: 'A', total: 50, payments: [{ amount: 50, status: 'CONFIRMED' }] },
    ]);
    expect(map.size).toBe(0);
  });
  it('ignora pagamentos porconfirmar', () => {
    const map = aggregateOutstandingByCustomer([
      { customerId: 'A', total: 100, payments: [{ amount: 100, status: 'PENDING' }] },
    ]);
    expect(map.get('A')).toBe(100);
  });
  it('lida com Decimal-like (toNumber)', () => {
    const dec = (n: number) => ({ toNumber: () => n });
    const map = aggregateOutstandingByCustomer([
      { customerId: 'A', total: dec(100), payments: [{ amount: dec(30), status: 'CONFIRMED' }] },
    ]);
    expect(map.get('A')).toBe(70);
  });
});

describe('aggregateOutstandingBySupplier', () => {
  it('agrega saldo por fornecedor com base em paidAmount', () => {
    const map = aggregateOutstandingBySupplier([
      { supplierId: 'S1', total: 200, paidAmount: 80, payments: [] },
      { supplierId: 'S1', total: 100, paidAmount: 0, payments: [] },
      { supplierId: 'S2', total: 50, paidAmount: 50, payments: [] },
    ]);
    expect(map.get('S1')).toBe(220);
    expect(map.get('S2')).toBeUndefined();
  });
});
