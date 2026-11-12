-- Avaliação de desempenho (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhReviewCycleStatus" AS ENUM ('ABERTO', 'FECHADO');
CREATE TYPE "RhReviewStatus" AS ENUM ('PENDENTE', 'ENTREGUE', 'VALIDADO');

CREATE TABLE "RhPerformanceCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "RhReviewCycleStatus" NOT NULL DEFAULT 'ABERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhPerformanceCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhPerfCriterion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RhPerfCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhPerformanceReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerName" TEXT,
    "score" INTEGER,
    "comments" TEXT,
    "status" "RhReviewStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhPerformanceReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhPerformanceReview_cycleId_employeeId_key" ON "RhPerformanceReview"("cycleId", "employeeId");
CREATE INDEX "RhPerformanceCycle_tenantId_status_idx" ON "RhPerformanceCycle"("tenantId", "status");
CREATE INDEX "RhPerfCriterion_tenantId_cycleId_order_idx" ON "RhPerfCriterion"("tenantId", "cycleId", "order");
CREATE INDEX "RhPerformanceReview_tenantId_cycleId_status_idx" ON "RhPerformanceReview"("tenantId", "cycleId", "status");

ALTER TABLE "RhPerformanceCycle" ADD CONSTRAINT "RhPerformanceCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPerfCriterion" ADD CONSTRAINT "RhPerfCriterion_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RhPerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPerformanceReview" ADD CONSTRAINT "RhPerformanceReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RhPerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPerformanceReview" ADD CONSTRAINT "RhPerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhPerformanceCycle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_performance_cycle_isolation" ON "RhPerformanceCycle" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPerfCriterion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_perf_criterion_isolation" ON "RhPerfCriterion" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPerformanceReview" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_performance_review_isolation" ON "RhPerformanceReview" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
