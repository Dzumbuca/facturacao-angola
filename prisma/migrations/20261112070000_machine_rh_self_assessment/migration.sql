-- Autoavaliação do funcionário (self-assessment) — aditivo; validar em produção antes de aplicar.

CREATE TABLE "RhPerformanceReviewSelfAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "selfScore" INTEGER,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhPerformanceReviewSelfAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhPerformanceReviewSelfAssessment_cycleId_employeeId_key" ON "RhPerformanceReviewSelfAssessment"("cycleId", "employeeId");
CREATE INDEX "RhPerformanceReviewSelfAssessment_tenantId_cycleId_idx" ON "RhPerformanceReviewSelfAssessment"("tenantId", "cycleId");

ALTER TABLE "RhPerformanceReviewSelfAssessment" ADD CONSTRAINT "RhPerformanceReviewSelfAssessment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RhPerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPerformanceReviewSelfAssessment" ADD CONSTRAINT "RhPerformanceReviewSelfAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhPerformanceReviewSelfAssessment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_performance_self_assessment_isolation" ON "RhPerformanceReviewSelfAssessment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
