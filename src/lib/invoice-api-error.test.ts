import { describe, expect, it } from 'vitest';
import { getInvoiceApiErrorMessage, getInvoiceServerErrorMessage } from './invoice-api-error';

describe('getInvoiceApiErrorMessage', () => {
  it('includes validation warnings returned by the PDF endpoint', () => {
    expect(getInvoiceApiErrorMessage({
      error: 'Fatura inválida',
      warnings: ['O NIF do adquirente tem formato inválido.'],
    })).toBe('Fatura inválida O NIF do adquirente tem formato inválido.');
  });
});

describe('getInvoiceServerErrorMessage', () => {
  it('identifies an unavailable database instead of reporting a PDF error', () => {
    expect(getInvoiceServerErrorMessage({ name: 'PrismaClientInitializationError' }))
      .toContain('base de dados não está disponível');
  });

  it('keeps unexpected server errors private and understandable', () => {
    expect(getInvoiceServerErrorMessage(new Error('internal details')))
      .toBe('Não foi possível emitir a fatura. Verifique os dados e tente novamente.');
  });
});
