import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    companyBankAccount: { findFirst: vi.fn() },
    invoiceDraft: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('./prisma', () => ({ prisma: prismaMock }));
vi.mock('./invoice-service', () => ({ issueInvoice: vi.fn() }));

import { createInvoiceDraft, updateInvoiceDraft } from './invoice-draft-service';
import type { InvoiceDraftInput } from './invoice-draft-validation';

const input: InvoiceDraftInput = {
  customerName: 'Cliente de teste', customerNif: null,
  items: [{ desc: 'Serviço', qty: 1, rate: 100, productId: null }],
  applyVat: true, discountType: 'amount', discountValue: 0, observations: null,
  includeCompanyProfile: true, currency: 'AOA', dueAt: null, companyBankAccountId: null,
};

const persistedDraft = {
  id: '44444444-4444-4444-8444-444444444444', tenantId: 'tenant-a', customerName: input.customerName,
  customerNif: input.customerNif, items: input.items, applyVat: true, discountType: 'amount', discountValue: 0,
  observations: null, includeCompanyProfile: true, currency: 'AOA', dueAt: null, companyBankAccountId: null, status: 'DRAFT',
};

describe('offline invoice draft server contract', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns the existing tenant draft on an identical stable-ID replay', async () => {
    prismaMock.invoiceDraft.create.mockRejectedValue({ code: 'P2002' });
    prismaMock.invoiceDraft.findUnique.mockResolvedValue(persistedDraft);
    await expect(createInvoiceDraft(input, 'tenant-a', persistedDraft.id)).resolves.toEqual(persistedDraft);
  });

  it('rejects a stable-ID replay with changed content or another tenant', async () => {
    prismaMock.invoiceDraft.create.mockRejectedValue({ code: 'P2002' });
    prismaMock.invoiceDraft.findUnique.mockResolvedValue({ ...persistedDraft, customerName: 'Conteúdo diferente' });
    await expect(createInvoiceDraft(input, 'tenant-a', persistedDraft.id)).rejects.toMatchObject({ status: 409 });
    prismaMock.invoiceDraft.findUnique.mockResolvedValue({ ...persistedDraft, tenantId: 'tenant-b' });
    await expect(createInvoiceDraft(input, 'tenant-a', persistedDraft.id)).rejects.toMatchObject({ status: 409 });
  });

  it('reports stale expected versions as conflicts and preserves the draft', async () => {
    const expectedUpdatedAt = new Date('2026-10-29T00:00:00.000Z');
    prismaMock.invoiceDraft.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.invoiceDraft.findFirst.mockResolvedValue({ id: persistedDraft.id });
    await expect(updateInvoiceDraft(persistedDraft.id, input, 'tenant-a', expectedUpdatedAt))
      .rejects.toMatchObject({ status: 409 });
    expect(prismaMock.invoiceDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: persistedDraft.id, tenantId: 'tenant-a', updatedAt: expectedUpdatedAt }),
      data: expect.objectContaining({ updatedAt: expect.any(Date) }),
    }));
    const updateCall = prismaMock.invoiceDraft.updateMany.mock.calls[0][0];
    expect(updateCall.data.updatedAt.getTime()).toBeGreaterThan(expectedUpdatedAt.getTime());
  });
});
