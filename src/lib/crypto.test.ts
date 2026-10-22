import { describe, it, expect } from 'vitest';
import { generateInvoiceHash } from './crypto';

describe('Crypto Hash Chaining (AGT Compliance)', () => {
  it('should generate a consistent SHA-256 hash for invoice data', () => {
    const data = {
      customerName: 'Empresa Teste Lda',
      customerNif: '5000000000',
      items: [{ desc: 'Serviço', qty: 1, rate: 1000 }],
      total: 1140,
    };
    const testDate = new Date('2026-10-18T10:00:00Z');

    const hash1 = generateInvoiceHash(data, 'ROOT', testDate);
    const hash2 = generateInvoiceHash(data, 'ROOT', testDate);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it('should change hash if previousHash changes (chaining integrity)', () => {
    const data = {
      customerName: 'Empresa Teste Lda',
      customerNif: '5000000000',
      items: [{ desc: 'Serviço', qty: 1, rate: 1000 }],
      total: 1140,
    };
    const testDate = new Date('2026-10-18T10:00:00Z');

    const hashRoot = generateInvoiceHash(data, 'ROOT', testDate);
    const hashPrevious = generateInvoiceHash(data, 'SOME_PREVIOUS_HASH_STRING', testDate);

    expect(hashRoot).not.toBe(hashPrevious);
  });
});