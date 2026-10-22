import { describe, expect, it } from 'vitest';
import { getSAFTPeriod, getSAFTDocumentType } from './saft-period';

describe('SAF-T period and document mapping', () => {
  it('defaults to the current calendar month and year', () => {
    expect(getSAFTPeriod(undefined, undefined, new Date(2026, 9, 19))).toEqual({ month: 10, year: 2026 });
  });

  it('maps credit notes to NC and ordinary invoices to FT', () => {
    expect(getSAFTDocumentType('NC')).toBe('NC');
    expect(getSAFTDocumentType('FT')).toBe('FT');
  });

  it('rejects months outside the calendar range', () => {
    expect(() => getSAFTPeriod('13', '2026')).toThrow();
  });
});
