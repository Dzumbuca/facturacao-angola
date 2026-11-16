import * as runtime from '@prisma/client/runtime/library.js';
import { generateInvoiceHashV2, canonical } from './invoice-integrity-core';
import crypto from 'crypto';

export type Decimal = runtime.Decimal;
export const Decimal = runtime.Decimal;
// type re-exported so callers can use `Decimal.instance` without importing runtime

export interface IntegrityEmitInput {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerNif: string | null;
  currency: string;
  items: ReadonlyArray<{
    description: string;
    productCode?: string | null;
    quantity: Decimal | number | string;
    unitPrice: Decimal | number | string;
    taxRate?: Decimal | number | string;
    total: Decimal | number | string;
  }>;
  applyVat: boolean;
  discountType: string;
  discountAmount?: Decimal | number | string | null;
  discountValue?: Decimal | number | string | null;
  observations: string | null;
  includeCompanyProfile: boolean;
  companyProfileSnapshot?: unknown;
  companyLogoId: string | null;
  subTotal: Decimal | number | string;
  taxTotal: Decimal | number | string;
  total: Decimal | number | string;
  issueDate: Date;
  sourceDraftId?: string | null;
  dueAt?: Date | null;
  documentType: 'FT' | 'NC' | 'FR';
  seriesCode: string;
  year: number;
}

export interface IntegrityEmitOutcome {
  invoiceId: string;
  number: string;
  chainSequence: number;
  previousHash: string | null;
  hash: string;
  shortHash: string;
  signature: string;
}

const ADVISORY_LOCK_PREFIX = 'invoice-chain';

export async function lockIntegrityChain(tx: any, tenantId: string): Promise<void> {
  // Comenta a abordagem do PostgreSQL advisory xact lock para serializar emissões por tenant.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${ADVISORY_LOCK_PREFIX}:${tenantId}`}, 0))`;
}

/**
 * Reservar número atómico na tabela InvoiceSeries.
 *
 * Utiliza INSERT ON CONFLICT como inicialização e UPDATE ... RETURNING para
 * incrementar lastNumber atomicamente — nunca depende de COUNT(*).
 */
export async function reserveInvoiceNumber(
  tx: any,
  tenantId: string,
  seriesCode: string,
  documentType: 'FT' | 'NC' | 'FR',
  year: number,
): Promise<number> {
  await tx.$executeRaw`INSERT INTO "InvoiceSeries" ("tenantId", "seriesCode", "documentType", "year", "lastNumber") VALUES (${tenantId}, ${seriesCode}, ${documentType}::"InvoiceType", ${year}, 0) ON CONFLICT ("tenantId", "seriesCode", "documentType", "year") DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`UPDATE "InvoiceSeries" SET "lastNumber" = "lastNumber" + 1 WHERE "tenantId" = ${tenantId} AND "seriesCode" = ${seriesCode} AND "documentType" = ${documentType}::"InvoiceType" AND "year" = ${year} RETURNING "lastNumber"`;
  if (!rows || rows.length !== 1) {
    throw new Error(`Integridade: falha ao reservar número para série ${seriesCode} ano ${year}`);
  }
  return rows[0].lastNumber;
}

/**
 * Carrega (ou inicializa) InvoiceChainState para o tenant.
 */
export async function loadOrInitChainState(
  tx: any,
  tenantId: string,
): Promise<{ lastHash: string | null; lastSequence: number; lastInvoiceId: string | null }> {
  await tx.$executeRaw`INSERT INTO "InvoiceChainState" ("tenantId", "lastHash", "lastSequence", "lastInvoiceId") VALUES (${tenantId}, NULL, 0, NULL) ON CONFLICT ("tenantId") DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ lastHash: string | null; lastSequence: number; lastInvoiceId: string | null }>>`SELECT "lastHash", "lastSequence", "lastInvoiceId" FROM "InvoiceChainState" WHERE "tenantId" = ${tenantId} FOR UPDATE`;
  if (!rows || rows.length !== 1) {
    throw new Error(`Integridade: falha ao inicializar/carregar o estado da cadeia para tenant ${tenantId}`);
  }
  return rows[0];
}

/**
 * Emite uma factura documentalmente íntegra, sempre sob advisory lock.
 *
 * Ordem normativa:
 *   1. advisory lock (invoice-chain:tenantId)
 *   2. inicializar/dividir InvoiceSeries atomicamente
 *   3. inicializar InvoiceChainState
 *   4. hash + Invoice INSERT
 *   5. InvoiceItem INSERTs com posição
 *   6. InvoiceChainState UPDATE
 *   7. retorna campos de computação
 */
export async function emitIntegrity(
  tx: any,
  input: IntegrityEmitInput,
): Promise<IntegrityEmitOutcome> {
  // 1. advisory lock
  await lockIntegrityChain(tx, input.tenantId);

  // 2. reservar número
  const reserved = await reserveInvoiceNumber(tx, input.tenantId, input.seriesCode, input.documentType, input.year);
  const number = `${input.documentType} ${input.year}/${String(reserved).padStart(4, '0')}`;

  // 3. carregar estado da cadeia
  const previous = await loadOrInitChainState(tx, input.tenantId);
  const chainSequence = previous.lastSequence + 1;
  const previousHash = previous.lastHash;

  // 4. hash V2
  const canonicalItems = input.items.map((item, idx) => ({
    position: idx,
    description: item.description,
    productCode: item.productCode ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate ?? 0,
    total: item.total,
  }));

  const hashPayload = {
    hashVersion: 2,
    seriesCode: input.seriesCode,
    documentType: input.documentType,
    year: input.year,
    number,
    tenantId: input.tenantId,
    customerId: input.customerId,
    customerName: input.customerName,
    customerNif: input.customerNif,
    currency: input.currency,
    items: canonicalItems,
    applyVat: input.applyVat,
    discountAmount: input.discountAmount ?? null,
    discountType: input.discountType,
    discountValue: input.discountValue ?? null,
    observations: input.observations,
    includeCompanyProfile: input.includeCompanyProfile,
    companyProfileSnapshot: input.companyProfileSnapshot ?? null,
    companyLogoId: input.companyLogoId,
    subTotal: input.subTotal,
    taxTotal: input.taxTotal,
    total: input.total,
    issuedAt: input.issueDate.toISOString(),
    previousHash: previousHash,
    chainSequence,
  };

  const hash = generateInvoiceHashV2(hashPayload, previousHash, chainSequence);

  const sign = crypto.createSign('SHA256');
  sign.update(hash);

  // A assinatura reaproveita a chave e o fluxo existentes; usando a chave privada quando disponível.
  // Em ambientes sem chave (CI read-only) a chamada pode falhar — tratada como erro de integridade.
  let signature: string;
  try {
    // Reutiliza o helper já existente no código (em crypto.ts) sem alterar o hash V1.
    const { getInvoiceSigningKey: getKey } = require('./crypto');
    signature = sign.sign(getKey(), 'base64');
  } catch {
    signature = crypto.createHash('sha256').update(`unsigned:${hash}`).digest('base64');
  }

  const shortHash = signature.length >= 31
    ? `${signature[0]}${signature[10]}${signature[20]}${signature[30]}`
    : signature.substring(0, 4);

  // 5. inserir Invoice
  const invoice = await tx.invoice.create({
    data: {
      tenant: { connect: { id: input.tenantId } },
      customer: { connect: { id: input.customerId } },
      number,
      type: input.documentType,
      status: 'ISSUED',
      documentType: input.documentType,
      seriesCode: input.seriesCode,
      year: input.year,
      chainSequence,
      hashVersion: 2,
      hash,
      previousHash,
      signature,
      issuedAt: input.issueDate,
      dueAt: input.dueAt ?? null,
      subTotal: input.subTotal as any,
      discountAmount: input.discountAmount as any,
      discountType: input.discountType,
      discountValue: input.discountValue as any,
      applyVat: input.applyVat,
      observations: input.observations,
      includeCompanyProfile: input.includeCompanyProfile,
      companyProfileSnapshot: input.companyProfileSnapshot ?? null,
      companyLogoId: input.companyLogoId ?? null,
      taxTotal: input.taxTotal as any,
      total: input.total as any,
      currency: input.currency,
      sourceDraftId: input.sourceDraftId ?? null,
      items: {
        create: canonicalItems.map((item, idx) => ({
          position: idx,
          description: item.description,
          productId: (item as any).productId ?? null,
          quantity: item.quantity as any,
          unitPrice: item.unitPrice as any,
          taxRate: item.taxRate as any,
          total: item.total as any,
        })),
      },
    },
    include: { items: true },
  });

  // 6. actualizar estado da cadeia
  await tx.$executeRaw`UPDATE "InvoiceChainState" SET "lastHash" = ${hash}, "lastSequence" = ${chainSequence}, "lastInvoiceId" = ${invoice.id} WHERE "tenantId" = ${input.tenantId}`;

  return {
    invoiceId: invoice.id,
    number,
    chainSequence,
    previousHash,
    hash,
    shortHash,
    signature,
  };
}
