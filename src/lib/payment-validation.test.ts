import { describe, expect, it } from 'vitest';
import { validatePaymentInput } from './payment-validation';

describe('validatePaymentInput', () => {
  it('accepts a manual AOA payment and normalizes optional fields', () => {
    const result = validatePaymentInput({ amount: '125.50', method: 'BANK_TRANSFER', paymentDate: '2026-10-19', idempotencyKey: 'attempt-1' });
    expect(result).toMatchObject({ ok: true, value: { amount: 125.5, currency: 'AOA', status: 'PENDING', reference: null, notes: null } });
  });
  it('rejects invalid amount, method, currency, date and key', () => {
    for (const value of [
      { amount: 0, method: 'CASH', idempotencyKey: 'a' },
      { amount: 1, method: 'UNKNOWN', idempotencyKey: 'a' },
      { amount: 1, method: 'CASH', currency: 'USD', idempotencyKey: 'a' },
      { amount: 1, method: 'CASH', paymentDate: 'invalid', idempotencyKey: 'a' },
      { amount: 1, method: 'CASH', idempotencyKey: '' },
    ]) expect(validatePaymentInput(value).ok).toBe(false);
  });
});
