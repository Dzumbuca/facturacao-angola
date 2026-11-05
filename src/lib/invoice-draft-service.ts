import { runWithTenant } from './tenant-db';
import { issueInvoice } from './invoice-service';
import type { InvoiceDraftInput } from './invoice-draft-validation';

export class InvoiceDraftServiceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function createInvoiceDraft(input: InvoiceDraftInput, tenantId: string, id?: string, userId?: string) {
  return runWithTenant(tenantId, async (tx) => {
    await assertBankAccount(input.companyBankAccountId, tenantId, tx);
    const data = {
      tenantId, customerName: input.customerName, customerNif: input.customerNif,
      items: input.items as any, applyVat: input.applyVat,
      discountType: input.discountType, discountValue: input.discountValue,
      observations: input.observations, includeCompanyProfile: input.includeCompanyProfile,
      currency: input.currency, dueAt: input.dueAt, companyBankAccountId: input.companyBankAccountId,
    };
    if (!id) return tx.invoiceDraft.create({ data });
    try {
      return await tx.invoiceDraft.create({ data: { ...data, id } });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && (error as any).code === 'P2002')) throw error;
      const existing = await tx.invoiceDraft.findUnique({ where: { id } });
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
  }, { userId });
}

export async function updateInvoiceDraft(id: string, input: InvoiceDraftInput, tenantId: string, expectedUpdatedAt?: Date, userId?: string) {
  return runWithTenant(tenantId, async (tx) => {
    await assertBankAccount(input.companyBankAccountId, tenantId, tx);
    const updated = await tx.invoiceDraft.updateMany({
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
      const exists = await tx.invoiceDraft.findFirst({ where: { id, tenantId }, select: { id: true } });
      throw new InvoiceDraftServiceError(exists ? 'O rascunho foi alterado no servidor.' : 'Rascunho não encontrado ou já emitido.', exists ? 409 : 404);
    }
    return tx.invoiceDraft.findFirst({ where: { id, tenantId } });
  }, { userId });
}

export async function getInvoiceDraft(id: string, tenantId: string, userId?: string) {
  return runWithTenant(tenantId, async (tx) => {
    const draft = await tx.invoiceDraft.findFirst({ where: { id, tenantId }, include: { issuedInvoice: true } });
    if (!draft) throw new InvoiceDraftServiceError('Rascunho não encontrado.', 404);
    return draft;
  }, { userId });
}

export async function listInvoiceDrafts(tenantId: string, userId?: string) {
  return runWithTenant(tenantId, (tx) => tx.invoiceDraft.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' }, include: { issuedInvoice: { select: { id: true, number: true, issuedAt: true } } } }), { userId });
}

export async function issueInvoiceDraft(id: string, tenantId: string, beforePersist?: (draft: any) => Promise<void>, userId?: string) {
  const prepared = await runWithTenant(tenantId, async (tx) => {
    const draft = await tx.invoiceDraft.findFirst({ where: { id, tenantId } });
    if (!draft) throw new InvoiceDraftServiceError('Rascunho não encontrado.', 404);
    const existing = await tx.invoice.findFirst({ where: { sourceDraftId: id, tenantId }, include: { customer: true, items: true, tenant: true } });
    if (existing) {
      await tx.invoiceDraft.updateMany({ where: { id, tenantId, status: { in: ['DRAFT', 'ISSUING'] } }, data: { status: 'ISSUED' } });
      return { existing } as const;
    }
    if (draft.status !== 'DRAFT') throw new InvoiceDraftServiceError('Este rascunho já foi emitido.', 409);
    if (!draft.customerName.trim()) throw new InvoiceDraftServiceError('Indique o nome do adquirente antes de emitir.', 400);
    const items = Array.isArray(draft.items) ? draft.items : [];
    if (!items.length) throw new InvoiceDraftServiceError('Adicione pelo menos um artigo antes de emitir.', 400);
    const claim = await tx.invoiceDraft.updateMany({ where: { id, tenantId, status: 'DRAFT' }, data: { status: 'ISSUING' } });
    if (!claim.count) throw new InvoiceDraftServiceError('Este rascunho está a ser emitido. Actualize a página.', 409);
    return { draft, items } as const;
  }, { userId });
  if ('existing' in prepared) return prepared.existing;

  let invoice;
  try {
    invoice = await issueInvoice({
      customerName: prepared.draft.customerName, customerNif: prepared.draft.customerNif,
      items: prepared.items, applyVat: prepared.draft.applyVat, discountType: prepared.draft.discountType,
      discountValue: Number(prepared.draft.discountValue), observations: prepared.draft.observations,
      includeCompanyProfile: prepared.draft.includeCompanyProfile, dueAt: prepared.draft.dueAt,
      sourceDraftId: prepared.draft.id, companyBankAccountId: prepared.draft.companyBankAccountId,
    }, tenantId, beforePersist);
  } catch (error) {
    const raced = await runWithTenant(tenantId, async (tx) => {
      const raced = await tx.invoice.findFirst({ where: { sourceDraftId: id, tenantId }, include: { customer: true, items: true, tenant: true } });
      if (raced) await tx.invoiceDraft.updateMany({ where: { id, tenantId, status: 'ISSUING' }, data: { status: 'ISSUED' } });
      else await tx.invoiceDraft.updateMany({ where: { id, tenantId, status: 'ISSUING' }, data: { status: 'DRAFT' } });
      return raced;
    }, { userId });
    if (raced) return raced;
    throw error;
  }
  return invoice;
}

async function assertBankAccount(id: string | null, tenantId: string, tx: any) {
  if (!id) return;
  const account = await tx.companyBankAccount.findFirst({ where: { id, tenantId, isActive: true }, select: { id: true } });
  if (!account) throw new InvoiceDraftServiceError('Conta bancária não encontrada ou inactiva.', 400);
}