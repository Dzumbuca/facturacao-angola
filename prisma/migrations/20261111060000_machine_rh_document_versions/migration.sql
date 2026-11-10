-- Machine Documents — versionamento de modelos (aditivo).

ALTER TABLE "RhDocumentTemplate" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RhDocument" ADD COLUMN "templateVersion" INTEGER;

CREATE TABLE "RhDocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RhDocumentType" NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhDocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhDocumentTemplateVersion_templateId_version_key" ON "RhDocumentTemplateVersion"("templateId", "version");
CREATE INDEX "RhDocumentTemplateVersion_tenantId_templateId_idx" ON "RhDocumentTemplateVersion"("tenantId", "templateId");

ALTER TABLE "RhDocumentTemplateVersion" ADD CONSTRAINT "RhDocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RhDocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhDocumentTemplateVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_doc_template_version_isolation" ON "RhDocumentTemplateVersion" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Snapshot inicial dos modelos existentes.
INSERT INTO "RhDocumentTemplateVersion" ("id", "tenantId", "templateId", "version", "name", "type", "body", "createdAt")
SELECT gen_random_uuid()::text, t."tenantId", t."id", 1, t."name", t."type", t."body", t."createdAt"
FROM "RhDocumentTemplate" t
WHERE NOT EXISTS (
  SELECT 1 FROM "RhDocumentTemplateVersion" v WHERE v."templateId" = t."id" AND v."version" = 1
);
