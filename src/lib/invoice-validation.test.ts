import { describe, expect, it } from 'vitest';
import { validateInvoiceRequest } from './invoice-validation';

describe('validateInvoiceRequest', () => {
  it('accepts a well-formed invoice with matching totals', () => {
    expect(validateInvoiceRequest({
      customerName: 'Cliente',
      customerNif: '5412345678',
      items: [{ desc: 'Serviço', qty: 1, rate: 100 }],
      total: 114,
    })).toEqual({ isValid: true, warnings: [] });
  });

  it('rejects invoices with empty lines, invalid quantities, or mismatched totals', () => {
    const invalid = validateInvoiceRequest({
      customerName: 'Cliente',
      customerNif: '5412345678',
      items: [{ desc: '', qty: -1, rate: 100 }],
      total: 1,
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.warnings.length).toBeGreaterThan(0);
  });

  it('rejects malformed NIFs rather than accepting any non-empty value', () => {
    expect(validateInvoiceRequest({
      customerName: 'Cliente',
      customerNif: 'abc',
      items: [{ desc: 'Serviço', qty: 1, rate: 100 }],
      total: 114,
    }).isValid).toBe(false);
  });

  it('accepts an invoice without a customer NIF', () => {
    expect(validateInvoiceRequest({
      customerName: 'Cliente sem NIF',
      customerNif: '',
      items: [{ desc: 'Serviço', qty: 1, rate: 100 }],
      total: 114,
    })).toEqual({ isValid: true, warnings: [] });
  });
});
