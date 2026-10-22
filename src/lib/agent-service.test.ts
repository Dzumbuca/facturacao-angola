import { describe, it, expect } from 'vitest';
import { invoiceAgent, validateInvoiceWithAgent } from './agent-service';

describe('AGT Compliance Assistant (KYC / Invoice Agent)', () => {
  it('should have correct agent metadata', () => {
    expect(invoiceAgent.name).toBe('AGT-Compliance-Assistant');
    expect(invoiceAgent.description).toBeDefined();
  });

  it('should validate an invoice successfully with NIF and amount', async () => {
    const result = await validateInvoiceWithAgent({
      customerName: 'Empresa Teste',
      customerNif: '5412345678',
      items: [{ desc: 'Serviço', qty: 1, rate: 150000 }],
      total: 171000,
    });
    expect(result.isValid).toBe(true);
    expect(result.fiscalMessage).toContain('conforme');
  });

  it('should accept an invoice when the optional NIF is missing', async () => {
    const result = await validateInvoiceWithAgent({
      customerName: 'Empresa Teste',
      customerNif: '',
      items: [{ desc: 'Serviço', qty: 1, rate: 50000 }],
      total: 57000,
    });
    expect(result.isValid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
