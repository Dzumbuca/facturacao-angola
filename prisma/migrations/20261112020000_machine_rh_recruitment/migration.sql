-- Recrutamento e seleção (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhJobOpeningStatus" AS ENUM ('ABERTA', 'ENCERRADA', 'CANCELADA');
CREATE TYPE "RhCandidateStatus" AS ENUM ('RECEBIDA', 'TRIAGEM', 'ENTREVISTA', 'AVALIACAO', 'APROVADO', 'REJEITADO', 'ADMITIDO');

CREATE TABLE "RhJobOpening" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionId" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "requirements" TEXT,
    "closesAt" TIMESTAMP(3),
    "status" "RhJobOpeningStatus" NOT NULL DEFAULT 'ABERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhJobOpening_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhCandidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "cvUrl" TEXT,
    "notes" TEXT,
    "status" "RhCandidateStatus" NOT NULL DEFAULT 'RECEBIDA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhCandidateEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fromStatus" "RhCandidateStatus",
    "toStatus" "RhCandidateStatus" NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhCandidateEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RhJobOpening_tenantId_status_idx" ON "RhJobOpening"("tenantId", "status");
CREATE INDEX "RhCandidate_tenantId_jobOpeningId_status_idx" ON "RhCandidate"("tenantId", "jobOpeningId", "status");
CREATE INDEX "RhCandidate_tenantId_email_idx" ON "RhCandidate"("tenantId", "email");
CREATE INDEX "RhCandidateEvent_tenantId_candidateId_idx" ON "RhCandidateEvent"("tenantId", "candidateId");

ALTER TABLE "RhJobOpening" ADD CONSTRAINT "RhJobOpening_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhJobOpening" ADD CONSTRAINT "RhJobOpening_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "RhDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhJobOpening" ADD CONSTRAINT "RhJobOpening_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "RhPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhCandidate" ADD CONSTRAINT "RhCandidate_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "RhJobOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhCandidateEvent" ADD CONSTRAINT "RhCandidateEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RhCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhJobOpening" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_job_opening_isolation" ON "RhJobOpening" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhCandidate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_candidate_isolation" ON "RhCandidate" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhCandidateEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_candidate_event_isolation" ON "RhCandidateEvent" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
