import * as runtime from '@prisma/client/runtime/library.js';

export type Decimal = runtime.Decimal;
export const Decimal = runtime.Decimal;

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
  // A8: chain autonomo via row locks on InvoiceChainState (FOR UPDATE);
  // advisory lock is intentionally REMOVED. The chain's semantics are
  // preserved by the SELECT … FOR UPDATE in loadOrInitChainState below.
  // This removes the advisory lock's cross-tx coupling and the 40P01
  // deadlock observed under concurrent FT issuance.
  await tx.$executeRaw`SELECT 1`; // no-op; serialization happens at loadOrInitChainState
}

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

export interface IdempotencyDecision {
  kind: 'replay' | 'conflict' | 'fresh';
  resultId?: string;
  payloadHash?: string;
}

export async function checkIdempotency(
  tx: any,
  tenantId: string,
  key: string,
  resource: string,
  payloadHash: string,
): Promise<IdempotencyDecision> {
  const rows = await tx.$queryRaw<Array<{ payloadHash: string; resultId: string }>>`SELECT "payloadHash", "resultId" FROM "IdempotentRequest" WHERE "tenantId" = ${tenantId} AND "key" = ${key} AND "resource" = ${resource}`;
  if (rows.length === 0) return { kind: 'fresh' };
  if (rows[0].payloadHash === payloadHash) {
    return { kind: 'replay', resultId: rows[0].resultId, payloadHash: rows[0].payloadHash };
  }
  return { kind: 'conflict', payloadHash: rows[0].payloadHash, resultId: rows[0].resultId };
}

export async function persistIdempotency(
  tx: any,
  tenantId: string,
  key: string,
  resource: string,
  payloadHash: string,
  resultId: string,
): Promise<void> {
  await tx.$executeRaw`INSERT INTO "IdempotentRequest" ("tenantId", "key", "resource", "payloadHash", "resultId", "createdAt")
    VALUES (${tenantId}, ${key}, ${resource}, ${payloadHash}, ${resultId}, now())
    ON CONFLICT ("tenantId", "key") DO UPDATE SET "payloadHash" = EXCLUDED."payloadHash", "resultId" = EXCLUDED."resultId"`;
}
