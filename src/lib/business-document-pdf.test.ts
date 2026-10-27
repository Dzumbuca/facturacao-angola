import { describe, expect, it } from 'vitest';
import { generateBusinessDocumentRecordPDF } from './business-document-pdf';

describe('generateBusinessDocumentRecordPDF', () => {
  it('creates a printable PDF from a persisted business document snapshot', async () => {
    const buffer = await generateBusinessDocumentRecordPDF({
      type: 'QUOTE', status: 'ISSUED', number: 'ORC 2026/0001', title: 'Serviços de manutenção',
      issueDate: new Date('2026-10-27T00:00:00Z'), validUntil: new Date('2026-11-11T00:00:00Z'), currency: 'AOA',
      companySnapshot: { name: 'Empresa Kiala', nif: '5000000000', address: 'Luanda' },
      customerSnapshot: { name: 'Cliente Kiala', nif: '5000000001' },
      items: [{ description: 'Manutenção', quantity: 2, unitPrice: 1000, taxRate: 14, total: 2280 }],
      subTotal: 2000, taxTotal: 280, total: 2280, details: null, notes: 'Validade 15 dias',
    });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
