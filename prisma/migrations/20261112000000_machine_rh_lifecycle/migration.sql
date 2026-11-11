-- Ciclo de vida do funcionário: histórico salarial e desligamento (aditivo).

CREATE TYPE "RhOffboardingStatus" AS ENUM ('EM_PROCESSO', 'CONCLUIDO');

CREATE TABLE "RhSalaryChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oldSalary" DECIMAL(14,2) NOT NULL,
    "newSalary" DECIMAL(14,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhSalaryChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhOffboarding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "lastDay" TIMESTAMP(3) NOT NULL,
    "status" "RhOffboardingStatus" NOT NULL DEFAULT 'CONCLUIDO',
    "notes" TEXT,
    "revokeAccess" BOOLEAN NOT NULL DEFAULT false,
    "decidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhOffboarding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RhSalaryChange_tenantId_employeeId_effectiveDate_idx" ON "RhSalaryChange"("tenantId", "employeeId", "effectiveDate");
CREATE UNIQUE INDEX "RhOffboarding_employeeId_key" ON "RhOffboarding"("employeeId");
CREATE INDEX "RhOffboarding_tenantId_status_idx" ON "RhOffboarding"("tenantId", "status");

ALTER TABLE "RhSalaryChange" ADD CONSTRAINT "RhSalaryChange_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhOffboarding" ADD CONSTRAINT "RhOffboarding_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhSalaryChange" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_salary_change_isolation" ON "RhSalaryChange" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhOffboarding" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_offboarding_isolation" ON "RhOffboarding" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
