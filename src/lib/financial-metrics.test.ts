import { describe, expect, it } from 'vitest';
import { aggregatePeriodMetrics } from './financial-metrics';

describe('aggregatePeriodMetrics', () => {
  it('separates issued invoices from confirmed receipts and keeps partial overdue balances overdue', () => {
    const period = { start: new Date('2026-10-01T00:00:00.000Z'), endExclusive: new Date('2026-11-01T00:00:00.000Z'), key: 'thisMonth', timeZone: 'Africa/Luanda' as const };
    const metrics = aggregatePeriodMetrics({
      invoices: [
        { id: 'a', type: 'FT', status: 'ISSUED', total: 100, issuedAt: new Date('2026-10-02'), dueAt: new Date('2026-10-10'), payments: [{ amount: 20, status: 'CONFIRMED', paymentDate: new Date('2026-10-03') }] },
        { id: 'b', type: 'FT', status: 'ANULADA', total: 50, issuedAt: new Date('2026-10-04'), dueAt: null, payments: [] },
        { id: 'c', type: 'NC', status: 'ISSUED', total: 10, issuedAt: new Date('2026-10-05'), dueAt: null, payments: [] },
      ],
      period,
      now: new Date('2026-10-19T12:00:00.000Z'),
    });
    expect(metrics.invoiced).toBe(100);
    expect(metrics.received).toBe(20);
    expect(metrics.outstanding).toBe(80);
    expect(metrics.overdue).toBe(80);
    expect(metrics.stateCounts.OVERDUE).toBe(1);
    expect(metrics.stateCounts.CANCELLED).toBe(0);
    expect(metrics.invoiceSeries.find((point) => point.date === '2026-10-03')?.value).toBe(0);
  });

  it('compares with the previous period and separates pending from confirmed methods', () => {
    const period = { start: new Date('2026-10-01T00:00:00.000Z'), endExclusive: new Date('2026-11-01T00:00:00.000Z'), key: 'thisMonth', timeZone: 'Africa/Luanda' as const };
    const metrics = aggregatePeriodMetrics({
      invoices: [{ id: 'new', type: 'FT', status: 'ISSUED', total: 150, issuedAt: new Date('2026-10-05'), dueAt: null, payments: [] }],
      previousInvoices: [{ id: 'old', type: 'FT', status: 'ISSUED', total: 100, issuedAt: new Date('2026-09-05'), dueAt: null, payments: [] }],
      payments: [
        { amount: 30, status: 'CONFIRMED', method: 'BANK_TRANSFER', paymentDate: new Date('2026-10-06') },
        { amount: 20, status: 'PENDING', method: 'BANK_TRANSFER', paymentDate: new Date('2026-10-07') },
      ], period,
    });
    expect(metrics.invoicedPrevious).toBe(100);
    expect(metrics.invoicedChangePercent).toBe(50);
    expect(metrics.received).toBe(30);
    expect(metrics.pendingTotal).toBe(20);
    expect(metrics.paymentMethods).toEqual([{ method: 'BANK_TRANSFER', confirmed: 30, pending: 20 }]);
  });
});
