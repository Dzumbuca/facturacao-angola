import { describe, expect, it } from 'vitest';
import { getInvoiceState } from './invoice-state';

describe('getInvoiceState', () => {
  const today = new Date('2026-10-20T12:00:00.000Z');

  it('keeps drafts outside issued and payment states', () => {
    expect(getInvoiceState({ status: 'DRAFT', type: 'FT', dueAt: null, total: 100 }, 0, today)).toBe('DRAFT');
  });

  it('marks annulled invoices and credit notes as cancelled for financial summaries', () => {
    expect(getInvoiceState({ status: 'ANULADA', type: 'FT', dueAt: null, total: 100 }, 0, today)).toBe('CANCELLED');
    expect(getInvoiceState({ status: 'ISSUED', type: 'NC', dueAt: null, total: 100 }, 0, today)).toBe('CANCELLED');
  });

  it('does not treat a partial payment as overdue until the local due date has passed', () => {
    expect(getInvoiceState({ status: 'ISSUED', type: 'FT', dueAt: new Date('2026-10-20T00:00:00.000Z'), total: 100 }, 30, today)).toBe('PARTIALLY_PAID');
  });

  it('marks partially paid invoices overdue after their due date in Luanda', () => {
    expect(getInvoiceState({ status: 'ISSUED', type: 'FT', dueAt: new Date('2026-10-19T00:00:00.000Z'), total: 100 }, 30, today)).toBe('OVERDUE');
  });

  it('marks an invoice paid when confirmed payments cover the total', () => {
    expect(getInvoiceState({ status: 'ISSUED', type: 'FT', dueAt: null, total: '100.00' }, 100, today)).toBe('PAID');
  });

  it('keeps legacy invoices without due dates issued until they are fully paid', () => {
    expect(getInvoiceState({ status: 'ISSUED', type: 'FT', dueAt: null, total: 100 }, 0, today)).toBe('ISSUED');
  });
});
