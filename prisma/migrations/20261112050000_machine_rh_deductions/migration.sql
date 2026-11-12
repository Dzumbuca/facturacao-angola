-- Descontos recorrentes (adiantamentos/empréstimos) integrados na folha (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhDeductionType" AS ENUM ('ADIANTAMENTO', 'EMPRESTIMO', 'OUTRO');

CREATE TABLE "RhEmployeeDeduction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RhDeductionType" NOT NULL DEFAULT 'OUTRO',
    "amount" DECIMAL(14,2) NOT NULL,
    "remainingInstallments" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhEmployeeDeduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RhEmployeeDeduction_tenantId_employeeId_active_idx" ON "RhEmployeeDeduction"("tenantId", "employeeId", "active");

ALTER TABLE "RhEmployeeDeduction" ADD CONSTRAINT "RhEmployeeDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhEmployeeDeduction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_employee_deduction_isolation" ON "RhEmployeeDeduction" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
