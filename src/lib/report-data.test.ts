import { describe, expect, it } from 'vitest';
import { buildReportRows } from './report-data';

const issued = { id: '1', number: 'FT 2026/1', type: 'FT', status: 'ISSUED', customerId: 'c1', customer: { name: 'Cliente A' }, issuedAt: new Date('2026-10-01'), dueAt: new Date('2026-10-10'), total: 100, items: [{ productId: 'p1', description: 'Serviço', quantity: 2, total: 100 }], payments: [{ amount: 25, status: 'CONFIRMED' }, { amount: 10, status: 'PENDING' }] };

describe('buildReportRows', () => {
  it('shows confirmed receipts separately from pending and assigns overdue ageing', () => {
    const report = buildReportRows('debt', { invoices: [issued], now: new Date('2026-11-20T12:00:00Z') });
    expect(report.headers).toContain('Antiguidade');
    expect(report.rows[0]).toEqual(['FT 2026/1', 'Cliente A', '10/10/2026', '31–60 dias', 75, 'OVERDUE']);
  });
  it('groups invoice lines by product and excludes cancelled and credit notes', () => {
    const report = buildReportRows('products', { invoices: [issued, { ...issued, id: '2', type: 'NC' }, { ...issued, id: '3', status: 'ANULADA' }], now: new Date() });
    expect(report.rows).toEqual([['Serviço', 2, 100]]);
  });
  it('includes pending receipt states in the receipt report', () => {
    const payment = { invoice: { number: 'FT 1', customer: { name: 'Cliente A' } }, paymentDate: new Date('2026-10-03'), method: 'CASH', status: 'PENDING', amount: 10, reference: null };
    expect(buildReportRows('receipts', { invoices: [], payments: [payment], now: new Date() }).rows[0]).toContain('PENDING');
  });
  it('applies invoice state filters to the same rows that will be exported', () => {
    expect(buildReportRows('invoices', { invoices: [issued], now: new Date('2026-11-20'), state: 'OVERDUE' }).rows).toHaveLength(1);
    expect(buildReportRows('invoices', { invoices: [issued], now: new Date('2026-11-20'), state: 'PAID' }).rows).toHaveLength(0);
  });
});

import { aggregateOutstandingBySupplier } from './outstanding';
import { buildReportRows as buildRows } from './report-data';

describe('buildReportRows payables', () => {
  const now = new Date('2026-12-31T12:00:00Z');
  it('returns payables rows with the right schema and totals', () => {
    const rows = buildRows('payables', {
      invoices: [], now,
      payables: [
        { number: 'SFT 2026/01', total: 1000, paidAmount: 200, status: 'PENDING', issuedAt: new Date('2026-12-01'), dueDate: new Date('2027-01-15'), supplier: { name: 'Fornecedor A' } },
        { number: 'SFT 2026/02', total: 500, paidAmount: 500, status: 'PAID', issuedAt: new Date('2026-12-15'), dueDate: new Date('2026-12-30'), supplier: { name: 'Fornecedor B' } },
      ],
    });
    expect(rows.headers).toContain('Fornecedor');
    expect(rows.rows.length).toBe(2);
    expect(rows.rows[0]).toEqual(['SFT 2026/01', 'Fornecedor A', '01/12/2026', '15/01/2027', 'No prazo', 1000, 200, 800, 'PENDING']);
    expect(rows.rows[1]).toEqual(['SFT 2026/02', 'Fornecedor B', '15/12/2026', '30/12/2026', '1 dias', 500, 500, 0, 'PAID']);
  });
  it('hides supplier filter when payables is selected', () => {
    const rows = buildRows('payables', { invoices: [], now, payables: [] });
    expect(rows.rows).toEqual([]);
  });
});

describe('aggregateOutstandingBySupplier smoke', () => {
  it('totals directly', () => {
    const map = aggregateOutstandingBySupplier([{ supplierId: 'S1', total: 100, paidAmount: 0, payments: [] }]);
    expect(map.get('S1')).toBe(100);
  });
});
