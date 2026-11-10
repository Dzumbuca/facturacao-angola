-- Payroll Connect — lotes de pagamento (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhPaymentProvider" AS ENUM ('MANUAL', 'EMIS');
CREATE TYPE "RhPaymentStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'FAILED');

CREATE TABLE "RhPaymentBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provider" "RhPaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "status" "RhPaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    CONSTRAINT "RhPaymentBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhPaymentItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "RhPaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhPaymentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhPaymentBatch_runId_key" ON "RhPaymentBatch"("runId");
CREATE INDEX "RhPaymentBatch_tenantId_status_idx" ON "RhPaymentBatch"("tenantId", "status");
CREATE UNIQUE INDEX "RhPaymentItem_batchId_employeeId_key" ON "RhPaymentItem"("batchId", "employeeId");
CREATE INDEX "RhPaymentItem_tenantId_status_idx" ON "RhPaymentItem"("tenantId", "status");

ALTER TABLE "RhPaymentBatch" ADD CONSTRAINT "RhPaymentBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPaymentBatch" ADD CONSTRAINT "RhPaymentBatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RhPayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPaymentItem" ADD CONSTRAINT "RhPaymentItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPaymentItem" ADD CONSTRAINT "RhPaymentItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RhPaymentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPaymentItem" ADD CONSTRAINT "RhPaymentItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhPaymentBatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_payment_batch_isolation" ON "RhPaymentBatch" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPaymentItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_payment_item_isolation" ON "RhPaymentItem" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
