-- Machine Point — núcleo de assiduidade (aditivo; não aplicar em produção sem aprovação).

ALTER TABLE "RhEmployee" ADD COLUMN "pinHash" TEXT;

CREATE TYPE "RhTimeEntryType" AS ENUM ('ENTRADA', 'SAIDA_ALMOCO', 'REGRESSO_ALMOCO', 'SAIDA');
CREATE TYPE "RhTimeSource" AS ENUM ('PIN', 'QR', 'MANUAL', 'DISPOSITIVO');

CREATE TABLE "RhTimeEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "RhTimeEntryType" NOT NULL,
    "source" "RhTimeSource" NOT NULL DEFAULT 'PIN',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RhTimeEntry_tenantId_occurredAt_idx" ON "RhTimeEntry"("tenantId", "occurredAt");
CREATE INDEX "RhTimeEntry_tenantId_employeeId_occurredAt_idx" ON "RhTimeEntry"("tenantId", "employeeId", "occurredAt");

ALTER TABLE "RhTimeEntry" ADD CONSTRAINT "RhTimeEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhTimeEntry" ADD CONSTRAINT "RhTimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhTimeEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_time_entry_isolation" ON "RhTimeEntry" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
