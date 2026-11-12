-- Justificações de faltas e notificações internas (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhJustificationStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

CREATE TABLE "RhAbsenceJustification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RhJustificationStatus" NOT NULL DEFAULT 'PENDENTE',
    "decisionNote" TEXT,
    "decidedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhAbsenceJustification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhAbsenceJustification_tenantId_employeeId_date_type_key" ON "RhAbsenceJustification"("tenantId", "employeeId", "date", "type");
CREATE INDEX "RhAbsenceJustification_tenantId_status_date_idx" ON "RhAbsenceJustification"("tenantId", "status", "date");
CREATE INDEX "RhNotification_tenantId_userId_readAt_idx" ON "RhNotification"("tenantId", "userId", "readAt");

ALTER TABLE "RhAbsenceJustification" ADD CONSTRAINT "RhAbsenceJustification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhNotification" ADD CONSTRAINT "RhNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhAbsenceJustification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_absence_justification_isolation" ON "RhAbsenceJustification" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhNotification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_notification_isolation" ON "RhNotification" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));