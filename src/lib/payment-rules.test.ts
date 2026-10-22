import { describe, expect, it } from 'vitest';
import { canRecordPayment, getInvoicePaymentTotals, getAllowedPaymentTransition } from './payment-rules';

describe('payment rules', () => {
  it('validates the remaining balance including pending payments', () => {
    expect(canRecordPayment(100, 70, 30)).toBe(true);
    expect(canRecordPayment(100, 70, 31)).toBe(false);
    expect(canRecordPayment(100, -1, 0)).toBe(false);
  });

  it('counts only confirmed payments as received and excludes cancelled/reversed', () => {
    expect(getInvoicePaymentTotals(100, [
      { amount: 20, status: 'CONFIRMED' }, { amount: 15, status: 'PENDING' },
      { amount: 10, status: 'CANCELLED' }, { amount: 5, status: 'REVERSED' },
    ])).toEqual({ confirmed: 20, pending: 15, outstanding: 80 });
  });

  it('allows only the documented transitions', () => {
    expect(getAllowedPaymentTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(getAllowedPaymentTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(getAllowedPaymentTransition('CONFIRMED', 'REVERSED')).toBe(true);
    expect(getAllowedPaymentTransition('PENDING', 'REVERSED')).toBe(false);
    expect(getAllowedPaymentTransition('REVERSED', 'CONFIRMED')).toBe(false);
  });
});
