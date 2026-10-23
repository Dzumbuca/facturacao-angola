-- CreateTable
CREATE TABLE "PlanPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerPhone" TEXT NOT NULL,
    "amountKz" DECIMAL(12,2) NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "proofName" TEXT,
    "proofData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanPayment_status_createdAt_idx" ON "PlanPayment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlanPayment_tenantId_idx" ON "PlanPayment"("tenantId");

-- AddForeignKey
ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

