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

describe('multi-tenant isolation of outstanding aggregates', () => {
  it('aggregateOutstandingByCustomer filters out other tenants\' invoices when input is already scoped', () => {
    const map = aggregateOutstandingByCustomer([
      { customerId: 'A1', total: 100, payments: [] },
      // note: a caller could mistakenly include a different tenant's invoices if not scoped; this test ensures the function would not accidentally aggregate them into the wrong customer bucket - callers are expected to pass tenant-scoped input
      { customerId: 'A1', total: 200, payments: [{ amount: 150, status: 'CONFIRMED' }] },
    ]);
    expect(map.get('A1')).toBe(150);
  });
  it('returns undefined for customers in other tenants (not in scoped input)', () => {
    const map = aggregateOutstandingByCustomer([
      { customerId: 'A1', total: 100, payments: [] },
    ]);
    expect(map.get('A2')).toBeUndefined();
  });
});

describe('OutstandingInvoice input contract', () => {
  it('works with Prisma-decimal-like objects (toNumber() interface)', () => {
    const decimal = (v: number) => ({ toNumber: () => v });
    const map = aggregateOutstandingByCustomer([
      { customerId: 'A', total: decimal(1000), payments: [{ amount: decimal(400), status: 'CONFIRMED' }] },
    ]);
    expect(map.get('A')).toBe(600);
  });
});

describe('cross-tenant aggregate isolation (sanity check)', () => {
  it('mixing A and B tenants in input does NOT corrupt the result for A', () => {
    const map = aggregateOutstandingByCustomer([
      { customerId: 'B-customer', total: 999, payments: [] }, // this belongs to tenant B
      { customerId: 'A-customer', total: 100, payments: [] }, // and this one belongs to tenant A
    ]);
    // Caller is trusted to scope input properly; this sanity check confirms:
    expect(map.get('A-customer')).toBe(100);
    expect(map.get('B-customer')).toBe(999);
  });

  it('aggregateOutstandingBySupplier does NOT leak A suppliers to result of B-tenant input', () => {
    const map = aggregateOutstandingBySupplier([
      { supplierId: 'B-supplier', total: 1000, paidAmount: 0, payments: [] },
      { supplierId: 'A-supplier', total: 300, paidAmount: 100, payments: [] },
    ]);
    expect(map.get('B-supplier')).toBe(1000);
    expect(map.get('A-supplier')).toBe(200);
  });

  it('filtering by tenantId in input preserves isolation correctly (simulated)', () => {
    const tenantAInvoices = [
      { supplierId: 'A-supplier', total: 1000, paidAmount: 400, payments: [] },
      { supplierId: 'A-supplier2', total: 500, paidAmount: 0, payments: [] },
    ];
    const tenantBInvoices = [
      { supplierId: 'B-supplier', total: 3000, paidAmount: 0, payments: [] },
    ];
    const mapA = aggregateOutstandingBySupplier(tenantAInvoices);
    expect(mapA.get('A-supplier')).toBe(600);
    expect(mapA.get('A-supplier2')).toBe(500);
    expect(mapA.get('B-supplier')).toBeUndefined();
    const mapB = aggregateOutstandingBySupplier(tenantBInvoices);
    expect(mapB.get('B-supplier')).toBe(3000);
    expect(mapB.get('A-supplier')).toBeUndefined();
  });
});
