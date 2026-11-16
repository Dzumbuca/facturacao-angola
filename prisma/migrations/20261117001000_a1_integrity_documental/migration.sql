-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('FT', 'NC', 'FR');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'ANULADA');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "chainSequence" INTEGER,
ADD COLUMN     "documentType" "InvoiceType",
ADD COLUMN     "hashVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seriesCode" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoiceSeries" (
    "tenantId" TEXT NOT NULL,
    "seriesCode" TEXT NOT NULL,
    "documentType" "InvoiceType" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY ("tenantId","seriesCode","documentType","year")
);

-- CreateTable
CREATE TABLE "InvoiceChainState" (
    "tenantId" TEXT NOT NULL,
    "lastHash" TEXT,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "lastInvoiceId" TEXT,

    CONSTRAINT "InvoiceChainState_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "IdempotentRequest" (
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotentRequest_pkey" PRIMARY KEY ("tenantId","key")
);

-- CreateIndex
CREATE INDEX "InvoiceSeries_tenantId_idx" ON "InvoiceSeries"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceChainState_lastInvoiceId_key" ON "InvoiceChainState"("lastInvoiceId");

-- CreateIndex
CREATE INDEX "IdempotentRequest_tenantId_resource_createdAt_idx" ON "IdempotentRequest"("tenantId", "resource", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotentRequest_resultId_idx" ON "IdempotentRequest"("resultId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_issuedAt_idx" ON "Invoice"("tenantId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_id_tenantId_key" ON "Invoice"("id", "tenantId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_position_idx" ON "InvoiceItem"("invoiceId", "position");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_seriesCode_documentType_year_fkey" FOREIGN KEY ("tenantId", "seriesCode", "documentType", "year") REFERENCES "InvoiceSeries"("tenantId", "seriesCode", "documentType", "year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSeries" ADD CONSTRAINT "InvoiceSeries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceChainState" ADD CONSTRAINT "InvoiceChainState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceChainState" ADD CONSTRAINT "InvoiceChainState_lastInvoiceId_fkey" FOREIGN KEY ("lastInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotentRequest" ADD CONSTRAINT "IdempotentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotentRequest" ADD CONSTRAINT "IdempotentRequest_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Partial unique index on chainSequence (only when not null)
CREATE UNIQUE INDEX "Invoice_tenantId_chainSequence_key"
  ON "Invoice" ("tenantId", "chainSequence")
  WHERE "chainSequence" IS NOT NULL;

-- Check that an ISSUED invoice has a chainSequence
ALTER TABLE "Invoice"
  ADD CONSTRAINT "invoice_issued_requires_chain_sequence"
  CHECK ("status" <> 'ISSUED' OR "chainSequence" IS NOT NULL);

-- Composite FK from InvoiceChainState into Invoice (tenant isolation)
ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT "invoice_chain_state_last_invoice_tenant_fkey"
  FOREIGN KEY ("lastInvoiceId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;

-- Composite FK from IdempotentRequest into Invoice (tenant isolation)
ALTER TABLE "IdempotentRequest"
  ADD CONSTRAINT "idempotent_request_result_tenant_fkey"
  FOREIGN KEY ("resultId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;

-- Invoice immutability trigger (insert/update)
CREATE OR REPLACE FUNCTION enforce_invoice_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('ISSUED', 'ANULADA') THEN
    IF NEW."tenantId"      IS DISTINCT FROM OLD."tenantId"
       OR NEW."type"         IS DISTINCT FROM OLD."type"
       OR NEW."number"       IS DISTINCT FROM OLD."number"
       OR NEW."seriesCode"   IS DISTINCT FROM OLD."seriesCode"
       OR NEW."year"         IS DISTINCT FROM OLD."year"
       OR NEW."documentType" IS DISTINCT FROM OLD."documentType"
       OR NEW."customerId"   IS DISTINCT FROM OLD."customerId"
       OR NEW."subTotal"     IS DISTINCT FROM OLD."subTotal"
       OR NEW."total"        IS DISTINCT FROM OLD."total"
       OR NEW."taxTotal"     IS DISTINCT FROM OLD."taxTotal"
       OR NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount"
       OR NEW."discountType" IS DISTINCT FROM OLD."discountType"
       OR NEW."discountValue" IS DISTINCT FROM OLD."discountValue"
       OR NEW."applyVat"     IS DISTINCT FROM OLD."applyVat"
       OR NEW."issuedAt"     IS DISTINCT FROM OLD."issuedAt"
       OR NEW."previousHash" IS DISTINCT FROM OLD."previousHash"
       OR NEW."hash"         IS DISTINCT FROM OLD."hash"
       OR NEW."hashVersion"  IS DISTINCT FROM OLD."hashVersion"
       OR NEW."chainSequence" IS DISTINCT FROM OLD."chainSequence"
       OR NEW."sourceDraftId" IS DISTINCT FROM OLD."sourceDraftId"
    THEN
      RAISE EXCEPTION 'Documento emitido não pode ser alterado'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'ISSUED' AND NEW.status = 'ANULADA' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'ISSUED' AND NEW.status <> 'ISSUED' THEN
    RAISE EXCEPTION 'ISSUED só pode transitar para ANULADA'
      USING ERRCODE = 'P0005';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'ANULADA' AND NEW.status <> 'ANULADA' THEN
    RAISE EXCEPTION 'Documento anulado não pode regressar a estado anterior'
      USING ERRCODE = 'P0006';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_immutability
  BEFORE UPDATE OF "tenantId", "type", "number", "seriesCode", "year", "documentType",
                  "customerId", "subTotal", "total", "taxTotal", "discountAmount", "discountType", "discountValue",
                  "applyVat", "issuedAt", "previousHash", "hash", "hashVersion", "chainSequence", "sourceDraftId", "status"
  ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_immutability();

CREATE OR REPLACE FUNCTION enforce_invoice_no_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED', 'ANULADA') THEN
    RAISE EXCEPTION 'Factura emitida/anulada não pode ser eliminada'
      USING ERRCODE = 'P0004';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_no_delete
  BEFORE DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_no_delete();

-- InvoiceItem immutability trigger
CREATE OR REPLACE FUNCTION enforce_invoice_item_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "status" IN ('ISSUED','ANULADA')) THEN
      RAISE EXCEPTION 'Não pode inserir item em factura emitida/anulada'
        USING ERRCODE = 'P0011';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "status" IN ('ISSUED','ANULADA')) THEN
      RAISE EXCEPTION 'Não pode alterar item de factura emitida/anulada'
        USING ERRCODE = 'P0012';
    END IF;
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "status" IN ('ISSUED','ANULADA')) THEN
      RAISE EXCEPTION 'Não pode transferir item para factura emitida/anulada'
        USING ERRCODE = 'P0013';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "status" IN ('ISSUED','ANULADA')) THEN
      RAISE EXCEPTION 'Não pode apagar item de factura emitida/anulada'
        USING ERRCODE = 'P0014';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_item_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_item_immutability();
