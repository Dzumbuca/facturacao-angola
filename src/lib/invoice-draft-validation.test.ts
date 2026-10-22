import { describe, expect, it } from 'vitest';
import { validateInvoiceDraftInput } from './invoice-draft-validation';

describe('validateInvoiceDraftInput', () => {
  it('accepts an incomplete draft without creating a customer', () => {
    expect(validateInvoiceDraftInput({ customerName: '', items: [] })).toEqual({
      ok: true,
      value: expect.objectContaining({ customerName: '', items: [], currency: 'AOA' }),
    });
    expect(validateInvoiceDraftInput({ items: [{ desc: '', qty: 1, rate: 0 }] }).ok).toBe(true);
  });

  it('normalizes valid editable data and rejects unsupported currency or oversized fields', () => {
    const valid = validateInvoiceDraftInput({ customerName: '  Cliente  ', items: [{ desc: ' Serviço ', qty: 2, rate: 10 }] });
    expect(valid.ok && valid.value.customerName).toBe('Cliente');
    expect(validateInvoiceDraftInput({ currency: 'USD' }).ok).toBe(false);
    expect(validateInvoiceDraftInput({ observations: 'x'.repeat(2001) }).ok).toBe(false);
  });

  it('rejects malformed items and invalid dates', () => {
    expect(validateInvoiceDraftInput({ items: [{ desc: '', qty: 0, rate: -1 }] }).ok).toBe(false);
    expect(validateInvoiceDraftInput({ dueAt: 'not-a-date' }).ok).toBe(false);
  });
});
