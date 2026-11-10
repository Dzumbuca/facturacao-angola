-- Machine Point — horários/turnos (aditivo; não aplicar em produção sem aprovação).

CREATE TABLE "RhShift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhShift_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RhEmployee" ADD COLUMN "shiftId" TEXT;

CREATE UNIQUE INDEX "RhShift_tenantId_name_key" ON "RhShift"("tenantId", "name");
CREATE INDEX "RhShift_tenantId_isActive_idx" ON "RhShift"("tenantId", "isActive");
CREATE INDEX "RhEmployee_tenantId_shiftId_idx" ON "RhEmployee"("tenantId", "shiftId");

ALTER TABLE "RhShift" ADD CONSTRAINT "RhShift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhEmployee" ADD CONSTRAINT "RhEmployee_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "RhShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RhShift" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_shift_isolation" ON "RhShift" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
