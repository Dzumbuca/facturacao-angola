import { describe, expect, it } from 'vitest';
import {
  calculateBusinessDocumentTotals,
  canConvertBusinessDocumentToInvoice,
  formatBusinessDocumentNumber,
  isBusinessDocumentTransitionAllowed,
  validateBusinessDocumentInput,
} from './business-document-core';

describe('business document validation', () => {
  it('normalizes a quote and calculates its commercial totals', () => {
    const result = validateBusinessDocumentInput({
      type: 'QUOTE',
      title: '  Fornecimento de computadores  ',
      customerId: 'customer-1',
      issueDate: '2026-10-27',
      validUntil: '2026-11-11',
      currency: 'AOA',
      items: [{ description: 'Portátil', quantity: 2, unitPrice: 1000, taxRate: 14, productId: 'product-1' }],
      notes: 'Pagamento por transferência',
    });
    expect(result).toMatchObject({ ok: true, value: { title: 'Fornecimento de computadores', type: 'QUOTE' } });
    if (result.ok) expect(calculateBusinessDocumentTotals(result.value.items)).toEqual({ subTotal: 2000, taxTotal: 280, total: 2280 });
  });

  it('rejects fiscal correction notes until their fiscal workflow is defined', () => {
    expect(validateBusinessDocumentInput({ type: 'CREDIT_NOTE', title: 'Nota de crédito' })).toMatchObject({ ok: false });
  });

  it('rejects impossible dates and invalid line values', () => {
    expect(validateBusinessDocumentInput({ type: 'QUOTE', title: 'Orçamento', issueDate: '2026-02-30', items: [{ description: 'Serviço', quantity: 1, unitPrice: 100, taxRate: 0 }] })).toMatchObject({ ok: false });
    expect(validateBusinessDocumentInput({ type: 'QUOTE', title: 'Orçamento', items: [{ description: 'Serviço', quantity: 0, unitPrice: 100, taxRate: 0 }] })).toMatchObject({ ok: false });
  });

  it('requires descriptive text for contracts and declarations', () => {
    expect(validateBusinessDocumentInput({ type: 'SERVICE_CONTRACT', title: 'Contrato' })).toMatchObject({ ok: false });
    expect(validateBusinessDocumentInput({ type: 'COMPANY_DECLARATION', title: 'Declaração', details: 'A empresa declara o seguinte.' })).toMatchObject({ ok: true });
  });

  it('requires a counterparty for sales documents but permits a manually entered supplier without creating a customer', () => {
    const input = { type: 'QUOTE', title: 'Orçamento', items: [{ description: 'Serviço', quantity: 1, unitPrice: 100, taxRate: 0 }] };
    expect(validateBusinessDocumentInput(input)).toMatchObject({ ok: false });
    expect(validateBusinessDocumentInput({ ...input, counterpartyName: 'Fornecedor externo' })).toMatchObject({ ok: true });
  });
});

describe('business document lifecycle', () => {
  it('only allows supported status transitions', () => {
    expect(isBusinessDocumentTransitionAllowed('DRAFT', 'ISSUED', 'QUOTE')).toBe(true);
    expect(isBusinessDocumentTransitionAllowed('ISSUED', 'ACCEPTED', 'QUOTE')).toBe(true);
    expect(isBusinessDocumentTransitionAllowed('ISSUED', 'ACCEPTED', 'DELIVERY_NOTE')).toBe(false);
    expect(isBusinessDocumentTransitionAllowed('CONVERTED', 'ISSUED', 'QUOTE')).toBe(false);
  });

  it('converts only accepted commercial documents with one consistent invoice tax mode', () => {
    const base = { status: 'ACCEPTED', type: 'QUOTE', items: [{ taxRate: 14 }, { taxRate: 14 }] };
    expect(canConvertBusinessDocumentToInvoice(base)).toMatchObject({ ok: true, applyVat: true });
    expect(canConvertBusinessDocumentToInvoice({ ...base, items: [{ taxRate: 0 }, { taxRate: 14 }] })).toMatchObject({ ok: false });
    expect(canConvertBusinessDocumentToInvoice({ ...base, type: 'SERVICE_CONTRACT' })).toMatchObject({ ok: false });
  });

  it('formats unique per-type annual references', () => {
    expect(formatBusinessDocumentNumber('QUOTE', 2026, 7)).toBe('ORC 2026/0007');
    expect(formatBusinessDocumentNumber('PROFORMA', 2026, 12)).toBe('PRO 2026/0012');
  });
});
