-- Separação catálogo/stock + limites por plano.
-- 1) Produto passa a indicar se controla stock (catálogo vs SKU do WMS).
-- 2) Limites configuráveis por plano (valores comerciais definidos pelo admin).

ALTER TABLE "Product" ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: produtos com stock > 0 passam a ser controlados.
UPDATE "Product" SET "trackStock" = true WHERE "stock" > 0;

CREATE TABLE "PlanLimit" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER,

    CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanLimit_planId_metric_key" ON "PlanLimit"("planId", "metric");
CREATE INDEX "PlanLimit_planId_idx" ON "PlanLimit"("planId");

ALTER TABLE "PlanLimit" ADD CONSTRAINT "PlanLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
