import {
  calculateBusinessDocumentTotals,
  canConvertBusinessDocumentToInvoice,
  isBusinessDocumentTransitionAllowed,
  validateBusinessDocumentInput,
  type BusinessDocumentInput,
  type BusinessDocumentItemInput,
  type BusinessDocumentStatus,
  type BusinessDocumentType,
} from './business-document-core';

export type BusinessDocumentContext = { tenantId: string; userId: string };
type StoredItem = BusinessDocumentItemInput & { position: number; subTotal: number; taxAmount: number; total: number };
type CompanySnapshot = Record<string, unknown>;
type CustomerSnapshot = Record<string, unknown>;
type StoredDocument = {
  id: string; tenantId: string; type: BusinessDocumentType; status: BusinessDocumentStatus;
  items: Array<BusinessDocumentItemInput & { taxRate: number }>;
  customerSnapshot?: CustomerSnapshot | null; convertedInvoiceDraft?: { id: string } | null;
  [key: string]: unknown;
};
type PreparedDocument = Omit<BusinessDocumentInput, 'issueDate' | 'validUntil'> & {
  tenantId: string; createdByUserId: string; issueDate: Date; validUntil: Date | null;
  companySnapshot: CompanySnapshot; customerSnapshot: CustomerSnapshot | null;
  items: StoredItem[]; subTotal: number; taxTotal: number; total: number;
};

export type BusinessDocumentRepository = {
  findCompany(tenantId: string): Promise<CompanySnapshot | null>;
  findCustomer(id: string, tenantId: string): Promise<CustomerSnapshot | null>;
  findProducts(ids: string[], tenantId: string): Promise<Array<{ id: string }>>;
  create(input: PreparedDocument): Promise<StoredDocument>;
  find(id: string, tenantId: string): Promise<StoredDocument | null>;
  updateDraft(id: string, tenantId: string, actorUserId: string, input: PreparedDocument): Promise<StoredDocument | null>;
  transition(id: string, tenantId: string, actorUserId: string, from: BusinessDocumentStatus, to: BusinessDocumentStatus): Promise<StoredDocument | null>;
  convertToInvoiceDraft(input: {
    documentId: string; tenantId: string; actorUserId: string; customerName: string; customerNif: string | null;
    items: Array<{ desc: string; qty: number; rate: number; productId: string | null }>;
    applyVat: boolean; observations: string | null;
  }): Promise<{ id: string } | null>;
  list(input: { tenantId: string; page: number; pageSize: number; query?: string; type?: BusinessDocumentType; status?: BusinessDocumentStatus; from?: Date; to?: Date }): Promise<{ documents: unknown[]; total: number }>;
};

type ServiceResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const failure = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error });
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function createBusinessDocumentService(repository: BusinessDocumentRepository) {
  async function prepare(input: unknown, context: BusinessDocumentContext, expectedType?: BusinessDocumentType): Promise<ServiceResult<PreparedDocument>> {
    const validation = validateBusinessDocumentInput(input);
    if (!validation.ok) return failure(400, validation.error);
    const document = validation.value;
    if (expectedType && document.type !== expectedType) return failure(400, 'O tipo do documento não pode ser alterado.');
    const [companySnapshot, linkedCustomer] = await Promise.all([
      repository.findCompany(context.tenantId),
      document.customerId ? repository.findCustomer(document.customerId, context.tenantId) : Promise.resolve(null),
    ]);
    if (!companySnapshot) return failure(404, 'Empresa não encontrada.');
    if (document.customerId && !linkedCustomer) return failure(400, 'O cliente seleccionado não pertence a esta empresa.');
    const productIds = [...new Set(document.items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
    const products = productIds.length ? await repository.findProducts(productIds, context.tenantId) : [];
    if (products.length !== productIds.length) return failure(400, 'Um ou mais artigos não pertencem a esta empresa.');
    const customerSnapshot = linkedCustomer ?? (document.counterpartyName ? {
      name: document.counterpartyName,
      nif: document.counterpartyNif,
      address: document.counterpartyAddress,
    } : null);

    const items: StoredItem[] = document.items.map((item, position) => {
      const subTotal = roundMoney(item.quantity * item.unitPrice);
      const taxAmount = roundMoney(subTotal * item.taxRate / 100);
      return { ...item, position, subTotal, taxAmount, total: roundMoney(subTotal + taxAmount) };
    });
    const totals = calculateBusinessDocumentTotals(items);
    return {
      ok: true,
      value: {
        ...document,
        issueDate: new Date(`${document.issueDate}T00:00:00.000Z`),
        validUntil: document.validUntil ? new Date(`${document.validUntil}T00:00:00.000Z`) : null,
        tenantId: context.tenantId,
        createdByUserId: context.userId,
        companySnapshot,
        customerSnapshot,
        items,
        ...totals,
      },
    };
  }

  return {
    async create(input: unknown, context: BusinessDocumentContext): Promise<ServiceResult<StoredDocument>> {
      const prepared = await prepare(input, context);
      if (!prepared.ok) return prepared;
      return { ok: true, value: await repository.create(prepared.value) };
    },

    async updateDraft(id: string, input: unknown, context: BusinessDocumentContext): Promise<ServiceResult<StoredDocument>> {
      const existing = await repository.find(id, context.tenantId);
      if (!existing) return failure(404, 'Documento não encontrado.');
      if (existing.status !== 'DRAFT') return failure(409, 'Um documento emitido não pode ser editado. Crie uma nova versão como rascunho.');
      const prepared = await prepare(input, context, existing.type);
      if (!prepared.ok) return prepared;
      const updated = await repository.updateDraft(id, context.tenantId, context.userId, prepared.value);
      return updated ? { ok: true, value: updated } : failure(409, 'O documento deixou de ser um rascunho e já não pode ser editado.');
    },

    async get(id: string, context: BusinessDocumentContext): Promise<StoredDocument | null> {
      return repository.find(id, context.tenantId);
    },

    async transition(id: string, target: BusinessDocumentStatus, context: BusinessDocumentContext): Promise<ServiceResult<StoredDocument>> {
      const existing = await repository.find(id, context.tenantId);
      if (!existing) return failure(404, 'Documento não encontrado.');
      if (!isBusinessDocumentTransitionAllowed(existing.status, target, existing.type)) return failure(409, 'Esta alteração de estado não é permitida.');
      const updated = await repository.transition(id, context.tenantId, context.userId, existing.status, target);
      return updated ? { ok: true, value: updated } : failure(409, 'O estado do documento foi alterado por outro utilizador. Actualize a página.');
    },

    async convertToInvoiceDraft(id: string, context: BusinessDocumentContext): Promise<ServiceResult<{ draftId: string }>> {
      const document = await repository.find(id, context.tenantId);
      if (!document) return failure(404, 'Documento não encontrado.');
      const conversion = canConvertBusinessDocumentToInvoice(document);
      if (!conversion.ok) return failure(409, conversion.error);
      const customer = (document.customerSnapshot ?? {}) as Record<string, unknown>;
      const created = await repository.convertToInvoiceDraft({
        documentId: id,
        tenantId: context.tenantId,
        actorUserId: context.userId,
        customerName: typeof customer.name === 'string' ? customer.name : '',
        customerNif: typeof customer.nif === 'string' ? customer.nif : null,
        items: document.items.map((item: any) => ({ desc: item.description, qty: Number(item.quantity), rate: Number(item.unitPrice), productId: item.productId ?? null })),
        applyVat: conversion.applyVat,
        observations: typeof document.notes === 'string' ? document.notes : null,
      });
      return created ? { ok: true, value: { draftId: created.id } } : failure(409, 'O documento já foi convertido ou deixou de estar aceite.');
    },

    async list(input: Parameters<BusinessDocumentRepository['list']>[0]) {
      return repository.list(input);
    },
  };
}
