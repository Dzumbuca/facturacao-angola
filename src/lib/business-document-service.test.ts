import { describe, expect, it, vi } from 'vitest';
import { createBusinessDocumentService } from './business-document-service';

function repository(overrides: Record<string, unknown> = {}) {
  return {
    findCompany: vi.fn(async (tenantId: string) => ({ id: tenantId, name: 'Empresa Kiala', nif: '5000000000' })),
    findCustomer: vi.fn(async (id: string, tenantId: string) => id === 'owned-customer' && tenantId === 'tenant-a' ? { id, name: 'Cliente Kiala', nif: '5000000001' } : null),
    findProducts: vi.fn(async (ids: string[], tenantId: string) => ids.includes('owned-product') && tenantId === 'tenant-a' ? [{ id: 'owned-product' }] : []),
    create: vi.fn(async (input: any) => ({ id: 'document-1', ...input, status: 'DRAFT', number: 'ORC 2026/0001', items: input.items })),
    find: vi.fn(async (_id: string, _tenantId: string) => null),
    updateDraft: vi.fn(async () => null),
    transition: vi.fn(async () => false),
    convertToInvoiceDraft: vi.fn(async () => null),
    list: vi.fn(async () => ({ documents: [], total: 0 })),
    ...overrides,
  };
}

const quote = {
  type: 'QUOTE', title: 'Orçamento', customerId: 'owned-customer', issueDate: '2026-10-27',
  items: [{ description: 'Serviço', quantity: 2, unitPrice: 1000, taxRate: 14, productId: 'owned-product' }],
};

describe('business document service tenant safety', () => {
  it('persists normalized snapshots and calculated totals under the authenticated tenant', async () => {
    const repo = repository();
    const service = createBusinessDocumentService(repo as any);
    const result = await service.create(quote, { tenantId: 'tenant-a', userId: 'user-a' });
    expect(repo.findCustomer).toHaveBeenCalledWith('owned-customer', 'tenant-a');
    expect(repo.findProducts).toHaveBeenCalledWith(['owned-product'], 'tenant-a');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a', createdByUserId: 'user-a', total: 2280,
      customerSnapshot: expect.objectContaining({ name: 'Cliente Kiala' }),
      companySnapshot: expect.objectContaining({ name: 'Empresa Kiala' }),
    }));
    expect(result.ok).toBe(true);
  });

  it('rejects customers and products owned by another tenant before persistence', async () => {
    const repo = repository();
    const service = createBusinessDocumentService(repo as any);
    const result = await service.create({ ...quote, customerId: 'foreign-customer' }, { tenantId: 'tenant-a', userId: 'user-a' });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('stores a manual counterparty as a snapshot without creating or linking a customer', async () => {
    const repo = repository();
    const service = createBusinessDocumentService(repo as any);
    await service.create({ ...quote, customerId: null, counterpartyName: 'Fornecedor sem ficha', counterpartyNif: '5000000002' }, { tenantId: 'tenant-a', userId: 'user-a' });
    expect(repo.findCustomer).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: null, customerSnapshot: { name: 'Fornecedor sem ficha', nif: '5000000002', address: null } }));
  });

  it('always scopes a document read by the tenant from access context', async () => {
    const repo = repository();
    const service = createBusinessDocumentService(repo as any);
    await service.get('document-foreign', { tenantId: 'tenant-a', userId: 'user-a' });
    expect(repo.find).toHaveBeenCalledWith('document-foreign', 'tenant-a');
  });

  it('blocks edits after the draft has been issued', async () => {
    const repo = repository({ find: vi.fn(async () => ({ id: 'document-1', tenantId: 'tenant-a', type: 'QUOTE', status: 'ISSUED', items: [] })) });
    const result = await createBusinessDocumentService(repo as any).updateDraft('document-1', quote, { tenantId: 'tenant-a', userId: 'user-a' });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(repo.updateDraft).not.toHaveBeenCalled();
  });

  it('creates an invoice draft only from an accepted, invoice-compatible document', async () => {
    const repo = repository({
      find: vi.fn(async () => ({
        id: 'document-1', tenantId: 'tenant-a', type: 'QUOTE', status: 'ACCEPTED',
        customerSnapshot: { name: 'Cliente Kiala', nif: '5000000001' }, notes: null,
        items: [{ description: 'Serviço', quantity: 2, unitPrice: 1000, taxRate: 14, productId: 'owned-product' }],
      })),
      convertToInvoiceDraft: vi.fn(async () => ({ id: 'invoice-draft-1' })),
    });
    const result = await createBusinessDocumentService(repo as any).convertToInvoiceDraft('document-1', { tenantId: 'tenant-a', userId: 'user-a' });
    expect(result).toEqual({ ok: true, value: { draftId: 'invoice-draft-1' } });
    expect(repo.convertToInvoiceDraft).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', applyVat: true, customerName: 'Cliente Kiala' }));
  });
});
