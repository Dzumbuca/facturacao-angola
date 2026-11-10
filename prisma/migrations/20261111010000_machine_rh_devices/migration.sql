-- Machine Point — dispositivos/terminais (aditivo; não aplicar em produção sem aprovação).

CREATE TABLE "RhDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhDevice_tokenHash_key" ON "RhDevice"("tokenHash");
CREATE UNIQUE INDEX "RhDevice_tenantId_name_key" ON "RhDevice"("tenantId", "name");
CREATE INDEX "RhDevice_tenantId_isActive_idx" ON "RhDevice"("tenantId", "isActive");

ALTER TABLE "RhDevice" ADD CONSTRAINT "RhDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhDevice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_device_isolation" ON "RhDevice" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
