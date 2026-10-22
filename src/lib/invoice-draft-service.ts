import { prisma } from './prisma';
import { issueInvoice } from './invoice-service';
import type { InvoiceDraftInput } from './invoice-draft-validation';

export class InvoiceDraftServiceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function createInvoiceDraft(input: InvoiceDraftInput, tenantId: string) {
  await assertBankAccount(input.companyBankAccountId, tenantId);
  return prisma.invoiceDraft.create({ data: {
    tenantId, customerName: input.customerName, customerNif: input.customerNif,
    items: input.items as any, applyVat: input.applyVat,
    discountType: input.discountType, discountValue: input.discountValue,
    observations: input.observations, includeCompanyProfile: input.includeCompanyProfile,
    currency: input.currency, dueAt: input.dueAt, companyBankAccountId: input.companyBankAccountId,
  } });
}

export async function updateInvoiceDraft(id: string, input: InvoiceDraftInput, tenantId: string) {
  await assertBankAccount(input.companyBankAccountId, tenantId);
  const updated = await prisma.invoiceDraft.updateMany({
    where: { id, tenantId, status: 'DRAFT' },
    data: {
      customerName: input.customerName, customerNif: input.customerNif,
      items: input.items as any, applyVat: input.applyVat,
      discountType: input.discountType, discountValue: input.discountValue,
      observations: input.observations, includeCompanyProfile: input.includeCompanyProfile,
      currency: input.currency, dueAt: input.dueAt, companyBankAccountId: input.companyBankAccountId,
    },
  });
  if (!updated.count) throw new InvoiceDraftServiceError('Rascunho não encontrado ou já emitido.', 404);
  return prisma.invoiceDraft.findFirst({ where: { id, tenantId } });
}

export async function getInvoiceDraft(id: string, tenantId: string) {
  const draft = await prisma.invoiceDraft.findFirst({ where: { id, tenantId }, include: { issuedInvoice: true } });
  if (!draft) throw new InvoiceDraftServiceError('Rascunho não encontrado.', 404);
  return draft;
}

export async function listInvoiceDrafts(tenantId: string) {
  return prisma.invoiceDraft.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' }, include: { issuedInvoice: { select: { id: true, number: true, issuedAt: true } } } });
}

export async function issueInvoiceDraft(id: string, tenantId: string, beforePersist?: (draft: any) => Promise<void>) {
  const draft = await prisma.invoiceDraft.findFirst({ where: { id, tenantId } });
  if (!draft) throw new InvoiceDraftServiceError('Rascunho não encontrado.', 404);
  const existing = await prisma.invoice.findFirst({ where: { sourceDraftId: id, tenantId }, include: { customer: true, items: true, tenant: true } });
  if (existing) {
    await prisma.invoiceDraft.updateMany({ where: { id, tenantId, status: { in: ['DRAFT', 'ISSUING'] } }, data: { status: 'ISSUED' } });
    return existing;
  }
  if (draft.status !== 'DRAFT') throw new InvoiceDraftServiceError('Este rascunho já foi emitido.', 409);
  if (!draft.customerName.trim()) throw new InvoiceDraftServiceError('Indique o nome do adquirente antes de emitir.', 400);
  const items = Array.isArray(draft.items) ? draft.items : [];
  if (!items.length) throw new InvoiceDraftServiceError('Adicione pelo menos um artigo antes de emitir.', 400);
  const claim = await prisma.invoiceDraft.updateMany({ where: { id, tenantId, status: 'DRAFT' }, data: { status: 'ISSUING' } });
  if (!claim.count) throw new InvoiceDraftServiceError('Este rascunho está a ser emitido. Actualize a página.', 409);
  let invoice;
  try {
    invoice = await issueInvoice({
      customerName: draft.customerName, customerNif: draft.customerNif,
      items, applyVat: draft.applyVat, discountType: draft.discountType,
      discountValue: Number(draft.discountValue), observations: draft.observations,
      includeCompanyProfile: draft.includeCompanyProfile, dueAt: draft.dueAt,
      sourceDraftId: draft.id, companyBankAccountId: draft.companyBankAccountId,
    }, tenantId, beforePersist);
  } catch (error) {
    const raced = await prisma.invoice.findFirst({ where: { sourceDraftId: id, tenantId }, include: { customer: true, items: true, tenant: true } });
    if (raced) {
      await prisma.invoiceDraft.updateMany({ where: { id, tenantId, status: 'ISSUING' }, data: { status: 'ISSUED' } });
      return raced;
    }
    await prisma.invoiceDraft.updateMany({ where: { id, tenantId, status: 'ISSUING' }, data: { status: 'DRAFT' } });
    throw error;
  }
  return invoice;
}

async function assertBankAccount(id: string | null, tenantId: string) {
  if (!id) return;
  const account = await prisma.companyBankAccount.findFirst({ where: { id, tenantId, isActive: true }, select: { id: true } });
  if (!account) throw new InvoiceDraftServiceError('Conta bancária não encontrada ou inactiva.', 400);
}
