ALTER TABLE "Tenant"
  ADD COLUMN "website" TEXT,
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankAccountName" TEXT,
  ADD COLUMN "iban" TEXT,
  ADD COLUMN "currentLogoId" TEXT;

CREATE UNIQUE INDEX "Tenant_currentLogoId_key" ON "Tenant"("currentLogoId");

CREATE TABLE "CompanyLogo" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyLogo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyLogo_tenantId_idx" ON "CompanyLogo"("tenantId");

ALTER TABLE "CompanyLogo"
  ADD CONSTRAINT "CompanyLogo_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_currentLogoId_fkey"
  FOREIGN KEY ("currentLogoId") REFERENCES "CompanyLogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD COLUMN "includeCompanyProfile" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "companyProfileSnapshot" JSONB,
  ADD COLUMN "companyLogoId" TEXT;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_companyLogoId_fkey"
  FOREIGN KEY ("companyLogoId") REFERENCES "CompanyLogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
