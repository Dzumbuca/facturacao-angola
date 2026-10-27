import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { formatBusinessDocumentNumber } from './business-document-core';
import type { BusinessDocumentRepository } from './business-document-service';

const db = prisma as any;
const includeDocument = {
  customer: { select: { id: true, name: true, nif: true, email: true } },
  items: { orderBy: { position: 'asc' } },
  events: { orderBy: { createdAt: 'desc' }, take: 30, include: { actorUser: { select: { name: true, email: true } } } },
  convertedInvoiceDraft: { select: { id: true, status: true, issuedInvoice: { select: { id: true, number: true, issuedAt: true } } } },
};

async function lockDocument(tx: any, id: string, tenantId: string) {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "status", "type"
    FROM "BusinessDocument"
    WHERE "id" = ${id} AND "tenantId" = ${tenantId}
    FOR UPDATE
  `);
  return Array.isArray(rows) && rows.length === 1 ? rows[0] as { id: string; status: string; type: string } : null;
}

export function createPrismaBusinessDocumentRepository(client: any = db): BusinessDocumentRepository {
  return {
    findCompany(tenantId) {
      return client.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, legalName: true, nif: true, address: true, municipality: true, province: true, country: true, phone: true, email: true, website: true, currentLogoId: true, brandColor: true, invoiceFooter: true },
      });
    },
    findCustomer(id, tenantId) {
      return client.customer.findFirst({ where: { id, tenantId }, select: { id: true, name: true, nif: true, address: true, email: true } });
    },
    findProducts(ids, tenantId) {
      return client.product.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true } });
    },
    async create(input) {
      return client.$transaction(async (tx: any) => {
        const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Africa/Luanda' }).format(input.issueDate));
        const counter = await tx.businessDocumentCounter.upsert({
          where: { tenantId_type_year: { tenantId: input.tenantId, type: input.type, year } },
          create: { tenantId: input.tenantId, type: input.type, year, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
          select: { lastNumber: true },
        });
        const { items, ...documentData } = input;
        return tx.businessDocument.create({
          data: {
            ...documentData,
            number: formatBusinessDocumentNumber(input.type, year, counter.lastNumber),
            status: 'DRAFT',
            items: { create: items.map((item) => ({ ...item, tenantId: input.tenantId })) },
            events: { create: { tenantId: input.tenantId, actorUserId: input.createdByUserId, eventType: 'CREATED', nextStatus: 'DRAFT', details: { type: input.type, number: formatBusinessDocumentNumber(input.type, year, counter.lastNumber) } } },
          },
          include: includeDocument,
        });
      });
    },
    find(id, tenantId) {
      return client.businessDocument.findFirst({ where: { id, tenantId }, include: includeDocument });
    },
    async updateDraft(id, tenantId, actorUserId, input) {
      return client.$transaction(async (tx: any) => {
        const locked = await lockDocument(tx, id, tenantId);
        if (!locked || locked.status !== 'DRAFT' || locked.type !== input.type) return null;
        const { items, tenantId: inputTenantId, createdByUserId: _createdByUserId, ...documentData } = input;
        await tx.businessDocument.update({ where: { id }, data: documentData });
        await tx.businessDocumentItem.deleteMany({ where: { businessDocumentId: id, tenantId } });
        if (items.length) await tx.businessDocumentItem.createMany({ data: items.map((item) => ({ ...item, tenantId: inputTenantId, businessDocumentId: id })) });
        await tx.businessDocumentEvent.create({ data: { tenantId, businessDocumentId: id, actorUserId, eventType: 'UPDATED', nextStatus: 'DRAFT', details: { changed: ['title', 'customer', 'dates', 'items', 'notes'] } } });
        return tx.businessDocument.findFirst({ where: { id, tenantId }, include: includeDocument });
      });
    },
    async transition(id, tenantId, actorUserId, from, to) {
      return client.$transaction(async (tx: any) => {
        const locked = await lockDocument(tx, id, tenantId);
        if (!locked || locked.status !== from) return null;
        const changed = await tx.businessDocument.updateMany({ where: { id, tenantId, status: from }, data: { status: to } });
        if (!changed.count) return null;
        const eventType = to as 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
        await tx.businessDocumentEvent.create({ data: { tenantId, businessDocumentId: id, actorUserId, eventType, previousStatus: from, nextStatus: to, details: {} } });
        return tx.businessDocument.findFirst({ where: { id, tenantId }, include: includeDocument });
      });
    },
    async convertToInvoiceDraft(input) {
      return client.$transaction(async (tx: any) => {
        const locked = await lockDocument(tx, input.documentId, input.tenantId);
        if (!locked || locked.status !== 'ACCEPTED' || !['PROPOSAL', 'QUOTE', 'PROFORMA'].includes(locked.type)) return null;
        const draft = await tx.invoiceDraft.create({
          data: {
            tenantId: input.tenantId,
            customerName: input.customerName,
            customerNif: input.customerNif,
            items: input.items,
            applyVat: input.applyVat,
            discountType: 'amount',
            discountValue: 0,
            observations: input.observations,
            includeCompanyProfile: true,
            currency: 'AOA',
            sourceBusinessDocumentId: input.documentId,
          },
          select: { id: true },
        });
        const changed = await tx.businessDocument.updateMany({ where: { id: input.documentId, tenantId: input.tenantId, status: 'ACCEPTED' }, data: { status: 'CONVERTED' } });
        if (!changed.count) throw new Error('BUSINESS_DOCUMENT_CONVERSION_CONFLICT');
        await tx.businessDocumentEvent.create({ data: {
          tenantId: input.tenantId, businessDocumentId: input.documentId, actorUserId: input.actorUserId,
          eventType: 'CONVERTED_TO_INVOICE_DRAFT', previousStatus: 'ACCEPTED', nextStatus: 'CONVERTED', details: { invoiceDraftId: draft.id },
        } });
        return draft;
      });
    },
    async list(input) {
      const where: any = { tenantId: input.tenantId };
      if (input.type) where.type = input.type;
      if (input.status) where.status = input.status;
      if (input.from || input.to) where.issueDate = { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) };
      if (input.query) {
        where.OR = [
          { number: { contains: input.query, mode: 'insensitive' } },
          { title: { contains: input.query, mode: 'insensitive' } },
          { customer: { is: { name: { contains: input.query, mode: 'insensitive' } } } },
          { items: { some: { description: { contains: input.query, mode: 'insensitive' } } } },
        ];
      }
      const [documents, total] = await Promise.all([
        client.businessDocument.findMany({ where, orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, include: { customer: { select: { name: true } }, items: { select: { description: true, quantity: true, unitPrice: true, total: true } } } }),
        client.businessDocument.count({ where }),
      ]);
      return { documents, total };
    },
  };
}

export const businessDocumentRepository = createPrismaBusinessDocumentRepository();
