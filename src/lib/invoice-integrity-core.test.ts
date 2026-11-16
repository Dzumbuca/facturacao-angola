import { describe, it, expect } from 'vitest';
import * as runtime from '@prisma/client/runtime/library.js';
import { canonicalDecimal, generateInvoiceHashV2, canonical, sha256Hex } from './invoice-integrity-core';

const Decimal = runtime.Decimal;

describe('canonicalDecimal', () => {
  const cases: Array<[string | number, string]> = [
    ['1000', '1000'],
    [new Decimal('1000.00') as any, '1000'],
    [new Decimal('0') as any, '0'],
    [new Decimal('0.10') as any, '0.1'],
    [new Decimal('0.1000') as any, '0.1'],
    [new Decimal('-100.50') as any, '-100.5'],
  ];

  it('normalises equivalent inputs to the same representation', () => {
    for (const [input, expected] of cases) {
      expect(canonicalDecimal(input)).toBe(expected);
    }
  });

  it('rejects NaN', () => {
    expect(() => canonicalDecimal(new Decimal('NaN') as any)).toThrow();
  });

  it('rejects Infinity', () => {
    expect(() => canonicalDecimal(new Decimal('Infinity') as any)).toThrow();
  });
});

describe('generateInvoiceHashV2', () => {
  const base = {
    hashVersion: 2,
    seriesCode: 'A',
    documentType: 'FT' as const,
    year: 2026,
    number: 'FT 2026/0001',
    tenantId: 't-uuid',
    customerId: 'c-uuid',
    customerName: 'C',
    customerNif: 'c',
    currency: 'AOA',
    items: [{
      position: 0,
      description: 'Item 1',
      productCode: null,
      quantity: new Decimal(1),
      unitPrice: new Decimal(1000),
      taxRate: new Decimal(14),
      total: new Decimal(1000),
    }],
    applyVat: true,
    discountAmount: new Decimal(0),
    discountType: 'amount',
    discountValue: new Decimal(0),
    observations: null,
    includeCompanyProfile: false,
    companyProfileSnapshot: null,
    companyLogoId: null,
    subTotal: new Decimal(1000),
    taxTotal: new Decimal(140),
    total: new Decimal(1140),
    issuedAt: new Date('2026-10-18T10:00:00Z').toISOString(),
    previousHash: '0'.repeat(64),
    chainSequence: 1,
  };

  it('produces deterministic 64-char SHA-256', () => {
    const hash = generateInvoiceHashV2(base as any, '0'.repeat(64), 1);
    expect(hash).toHaveLength(64);
    const hash2 = generateInvoiceHashV2(base as any, '0'.repeat(64), 1);
    expect(hash).toBe(hash2);
  });
});
