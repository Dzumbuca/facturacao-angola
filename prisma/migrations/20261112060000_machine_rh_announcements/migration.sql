-- Comunicados internos (aditivo; não aplicar em produção sem aprovação).

CREATE TABLE "RhAnnouncement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RhAnnouncement_tenantId_publishedAt_idx" ON "RhAnnouncement"("tenantId", "publishedAt");
ALTER TABLE "RhAnnouncement" ADD CONSTRAINT "RhAnnouncement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhAnnouncement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_announcement_isolation" ON "RhAnnouncement" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
