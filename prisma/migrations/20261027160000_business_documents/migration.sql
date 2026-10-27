CREATE TYPE "BusinessDocumentType" AS ENUM (
    'PROPOSAL',
    'QUOTE',
    'PROFORMA',
    'PURCHASE_ORDER',
    'DELIVERY_NOTE',
    'SERVICE_ORDER',
    'SERVICE_CONTRACT',
    'COMPANY_DECLARATION'
);

CREATE TYPE "BusinessDocumentStatus" AS ENUM (
    'DRAFT',
    'ISSUED',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED',
    'CONVERTED'
);

CREATE TYPE "BusinessDocumentEventType" AS ENUM (
    'CREATED',
    'UPDATED',
    'ISSUED',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED',
    'CONVERTED_TO_INVOICE_DRAFT'
);

CREATE TABLE "BusinessDocumentCounter" (
    "tenantId" TEXT NOT NULL,
    "type" "BusinessDocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BusinessDocumentCounter_pkey" PRIMARY KEY ("tenantId", "type", "year")
);

CREATE TABLE "BusinessDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "BusinessDocumentType" NOT NULL,
    "status" "BusinessDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerId" TEXT,
    "createdByUserId" TEXT,
    "issueDate" DATE NOT NULL,
    "validUntil" DATE,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "details" TEXT,
    "notes" TEXT,
    "subTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "companySnapshot" JSONB NOT NULL,
    "customerSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDocumentItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessDocumentId" TEXT NOT NULL,
    "productId" TEXT,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subTotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "BusinessDocumentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDocumentEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessDocumentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "BusinessDocumentEventType" NOT NULL,
    "previousStatus" "BusinessDocumentStatus",
    "nextStatus" "BusinessDocumentStatus",
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessDocumentEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvoiceDraft" ADD COLUMN "sourceBusinessDocumentId" TEXT;

CREATE UNIQUE INDEX "InvoiceDraft_sourceBusinessDocumentId_key" ON "InvoiceDraft"("sourceBusinessDocumentId");
CREATE UNIQUE INDEX "BusinessDocument_tenantId_type_number_key" ON "BusinessDocument"("tenantId", "type", "number");
CREATE INDEX "BusinessDocument_tenantId_type_status_issueDate_idx" ON "BusinessDocument"("tenantId", "type", "status", "issueDate");
CREATE INDEX "BusinessDocument_tenantId_issueDate_idx" ON "BusinessDocument"("tenantId", "issueDate");
CREATE INDEX "BusinessDocument_customerId_issueDate_idx" ON "BusinessDocument"("customerId", "issueDate");
CREATE INDEX "BusinessDocumentItem_tenantId_businessDocumentId_position_idx" ON "BusinessDocumentItem"("tenantId", "businessDocumentId", "position");
CREATE INDEX "BusinessDocumentItem_productId_idx" ON "BusinessDocumentItem"("productId");
CREATE INDEX "BusinessDocumentEvent_tenantId_createdAt_idx" ON "BusinessDocumentEvent"("tenantId", "createdAt");
CREATE INDEX "BusinessDocumentEvent_businessDocumentId_createdAt_idx" ON "BusinessDocumentEvent"("businessDocumentId", "createdAt");

ALTER TABLE "BusinessDocumentCounter" ADD CONSTRAINT "BusinessDocumentCounter_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentItem" ADD CONSTRAINT "BusinessDocumentItem_businessDocumentId_fkey"
  FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentItem" ADD CONSTRAINT "BusinessDocumentItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentEvent" ADD CONSTRAINT "BusinessDocumentEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentEvent" ADD CONSTRAINT "BusinessDocumentEvent_businessDocumentId_fkey"
  FOREIGN KEY ("businessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDocumentEvent" ADD CONSTRAINT "BusinessDocumentEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceDraft" ADD CONSTRAINT "InvoiceDraft_sourceBusinessDocumentId_fkey"
  FOREIGN KEY ("sourceBusinessDocumentId") REFERENCES "BusinessDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
