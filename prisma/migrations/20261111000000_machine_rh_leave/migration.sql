-- Férias, licenças e configurações RH (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhLeaveType" AS ENUM ('FERIAS', 'LICENCA', 'DISPENSA', 'DOENCA', 'OUTRA');
CREATE TYPE "RhLeaveStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO');

CREATE TABLE "RhLeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "RhLeaveType" NOT NULL DEFAULT 'FERIAS',
    "status" "RhLeaveStatus" NOT NULL DEFAULT 'PENDENTE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhSettings" (
    "tenantId" TEXT NOT NULL,
    "vacationDaysPerYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhSettings_pkey" PRIMARY KEY ("tenantId")
);

CREATE INDEX "RhLeaveRequest_tenantId_status_startDate_idx" ON "RhLeaveRequest"("tenantId", "status", "startDate");
CREATE INDEX "RhLeaveRequest_tenantId_employeeId_idx" ON "RhLeaveRequest"("tenantId", "employeeId");

ALTER TABLE "RhLeaveRequest" ADD CONSTRAINT "RhLeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhLeaveRequest" ADD CONSTRAINT "RhLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhSettings" ADD CONSTRAINT "RhSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhLeaveRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_leave_isolation" ON "RhLeaveRequest" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_settings_isolation" ON "RhSettings" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
