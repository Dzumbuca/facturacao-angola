import { prisma } from './prisma';
import { issueInvoice } from './invoice-service';
import type { InvoiceDraftInput } from './invoice-draft-validation';

export class InvoiceDraftServiceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function createInvoiceDraft(input: InvoiceDraftInput, tenantId: string, id?: string) {
  await assertBankAccount(input.companyBankAccountId, tenantId);
  const data = {
    tenantId, customerName: input.customerName, customerNif: input.customerNif,
    items: input.items as any, applyVat: input.applyVat,
    discountType: input.discountType, discountValue: input.discountValue,
    observations: input.observations, includeCompanyProfile: input.includeCompanyProfile,
    currency: input.currency, dueAt: input.dueAt, companyBankAccountId: input.companyBankAccountId,
  };
  if (!id) return prisma.invoiceDraft.create({ data });
  try {
    return await prisma.invoiceDraft.create({ data: { ...data, id } });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
    const existing = await prisma.invoiceDraft.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) throw new InvoiceDraftServiceError('Este identificador de rascunho já existe.', 409);
    const samePayload = existing.status === 'DRAFT'
      && existing.customerName === input.customerName && existing.customerNif === input.customerNif
      && JSON.stringify(existing.items) === JSON.stringify(input.items)
      && existing.applyVat === input.applyVat && existing.discountType === input.discountType
      && Number(existing.discountValue) === input.discountValue && existing.observations === input.observations
      && existing.includeCompanyProfile === input.includeCompanyProfile && existing.currency === input.currency
      && (existing.dueAt?.getTime() ?? null) === (input.dueAt?.getTime() ?? null)
      && existing.companyBankAccountId === input.companyBankAccountId;
    if (!samePayload) throw new InvoiceDraftServiceError('O rascunho foi alterado no servidor.', 409);
    return existing;
  }
}

export async function updateInvoiceDraft(id: string, input: InvoiceDraftInput, tenantId: string, expectedUpdatedAt?: Date) {
  await assertBankAccount(input.companyBankAccountId, tenantId);
  const updated = await prisma.invoiceDraft.updateMany({
    where: { id, tenantId, status: 'DRAFT', ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
    data: {
      customerName: input.customerName, customerNif: input.customerNif,
      items: input.items as any, applyVat: input.applyVat,
      discountType: input.discountType, discountValue: input.discountValue,
      observations: input.observations, includeCompanyProfile: input.includeCompanyProfile,
      currency: input.currency, dueAt: input.dueAt, companyBankAccountId: input.companyBankAccountId,
      ...(expectedUpdatedAt ? { updatedAt: new Date(Math.max(Date.now(), expectedUpdatedAt.getTime() + 1)) } : {}),
    },
  });
  if (!updated.count) {
    const exists = await prisma.invoiceDraft.findFirst({ where: { id, tenantId }, select: { id: true } });
    throw new InvoiceDraftServiceError(exists ? 'O rascunho foi alterado no servidor.' : 'Rascunho não encontrado ou já emitido.', exists ? 409 : 404);
  }
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
