import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';

const models = new Map(Prisma.dmmf.datamodel.models.map((model: { name: string; fields: { name: string }[] }) => [
  model.name,
  model.fields.map((field: { name: string }) => field.name),
]));

describe('financial schema generated client', () => {
  it('exposes payment and audit models with invoice tenant scoping', () => {
    expect(models.has('Payment')).toBe(true);
    expect(models.get('Payment')).toEqual(expect.arrayContaining([
      'id', 'tenantId', 'invoiceId', 'amount', 'currency', 'method', 'status',
      'paymentDate', 'reference', 'notes', 'idempotencyKey', 'createdByUserId', 'events',
    ]));
    expect(models.has('PaymentEvent')).toBe(true);
    expect(models.get('PaymentEvent')).toEqual(expect.arrayContaining([
      'id', 'tenantId', 'paymentId', 'eventType', 'previousStatus', 'nextStatus',
      'actorUserId', 'snapshot', 'createdAt',
    ]));
  });

  it('exposes due date, currency and company preferences needed by new invoices', () => {
    expect(models.get('Invoice')).toEqual(expect.arrayContaining(['dueAt', 'currency', 'payments']));
    expect(models.get('Tenant')).toEqual(expect.arrayContaining([
      'legalName', 'municipality', 'province', 'country', 'brandColor', 'invoiceFooter',
      'defaultMessage', 'defaultCurrency', 'documentLanguage', 'defaultPaymentDays',
      'defaultPaymentMethod', 'defaultObservations', 'bankAccounts',
    ]));
    expect(models.has('CompanyBankAccount')).toBe(true);
  });

  it('stores editable drafts without requiring a customer or fiscal number', () => {
    expect(models.get('Invoice')).toEqual(expect.arrayContaining(['sourceDraftId', 'sourceDraft']));
    expect(models.get('InvoiceDraft')).toEqual(expect.arrayContaining([
      'id', 'tenantId', 'customerName', 'customerNif', 'items', 'applyVat',
      'discountType', 'discountValue', 'observations', 'includeCompanyProfile',
      'dueAt', 'companyBankAccountId', 'status', 'issuedInvoice', 'createdAt', 'updatedAt',
    ]));
  });
});
