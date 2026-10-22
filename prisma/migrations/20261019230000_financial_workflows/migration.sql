ALTER TABLE "Tenant"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "municipality" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "brandColor" TEXT,
  ADD COLUMN "invoiceFooter" TEXT,
  ADD COLUMN "defaultMessage" TEXT,
  ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'AOA',
  ADD COLUMN "documentLanguage" TEXT NOT NULL DEFAULT 'pt-AO',
  ADD COLUMN "defaultPaymentDays" INTEGER,
  ADD COLUMN "defaultPaymentMethod" TEXT,
  ADD COLUMN "defaultObservations" TEXT;

ALTER TABLE "Invoice"
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AOA';

CREATE TABLE "CompanyBankAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountHolder" TEXT,
  "iban" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'AOA',
  "label" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyBankAccount_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CompanyBankAccount_tenantId_isActive_idx"
  ON "CompanyBankAccount"("tenantId", "isActive");
CREATE UNIQUE INDEX "CompanyBankAccount_one_active_primary_per_tenant_key"
  ON "CompanyBankAccount"("tenantId") WHERE "isActive" = true AND "isPrimary" = true;

INSERT INTO "CompanyBankAccount" (
  "id", "tenantId", "bankName", "accountHolder", "iban", "currency", "label", "isActive", "isPrimary", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, "id", COALESCE(NULLIF(BTRIM("bankName"), ''), 'Banco não indicado'),
       NULLIF(BTRIM("bankAccountName"), ''), NULLIF(BTRIM("iban"), ''), 'AOA', 'Conta existente', true, true,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant"
WHERE NULLIF(BTRIM("bankName"), '') IS NOT NULL
   OR NULLIF(BTRIM("bankAccountName"), '') IS NOT NULL
   OR NULLIF(BTRIM("iban"), '') IS NOT NULL;

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AOA',
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amount_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "Payment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Payment_tenantId_idempotencyKey_key" ON "Payment"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "Payment_invoiceId_method_reference_key" ON "Payment"("invoiceId", "method", "reference");
CREATE INDEX "Payment_tenantId_paymentDate_idx" ON "Payment"("tenantId", "paymentDate");
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");
CREATE INDEX "Payment_invoiceId_status_idx" ON "Payment"("invoiceId", "status");

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "nextStatus" TEXT,
  "actorUserId" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentEvent_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentEvent_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PaymentEvent_tenantId_createdAt_idx" ON "PaymentEvent"("tenantId", "createdAt");
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");
