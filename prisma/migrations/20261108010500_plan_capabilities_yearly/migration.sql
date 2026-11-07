-- Preços anuais + capabilities por plano (ex.: transferências entre armazéns).

ALTER TABLE "SubscriptionPlan" ADD COLUMN "priceYearly" DECIMAL(12,2);

CREATE TABLE "PlanCapability" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlanCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanCapability_planId_capability_key" ON "PlanCapability"("planId", "capability");
CREATE INDEX "PlanCapability_planId_idx" ON "PlanCapability"("planId");

ALTER TABLE "PlanCapability" ADD CONSTRAINT "PlanCapability_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
