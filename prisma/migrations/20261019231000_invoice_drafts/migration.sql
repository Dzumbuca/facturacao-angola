CREATE TABLE "InvoiceDraft" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL DEFAULT '',
  "customerNif" TEXT,
  "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "applyVat" BOOLEAN NOT NULL DEFAULT true,
  "discountType" TEXT NOT NULL DEFAULT 'amount',
  "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "observations" TEXT,
  "includeCompanyProfile" BOOLEAN NOT NULL DEFAULT true,
  "currency" TEXT NOT NULL DEFAULT 'AOA',
  "dueAt" TIMESTAMP(3),
  "companyBankAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceDraft_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvoiceDraft_companyBankAccountId_fkey"
    FOREIGN KEY ("companyBankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InvoiceDraft_tenantId_updatedAt_idx" ON "InvoiceDraft"("tenantId", "updatedAt");
