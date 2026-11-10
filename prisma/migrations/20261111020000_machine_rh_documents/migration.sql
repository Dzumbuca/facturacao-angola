-- Machine Documents — modelos e documentos (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhDocumentType" AS ENUM ('CONTRATO', 'DECLARACAO_TRABALHO', 'DECLARACAO_RENDIMENTOS', 'DECLARACAO_FERIAS', 'OUTRO');
CREATE TYPE "RhDocumentStatus" AS ENUM ('RASCUNHO', 'EMITIDO', 'ANULADO');

CREATE TABLE "RhDocumentTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RhDocumentType" NOT NULL DEFAULT 'OUTRO',
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhDocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "templateId" TEXT,
    "type" "RhDocumentType" NOT NULL DEFAULT 'OUTRO',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "RhDocumentStatus" NOT NULL DEFAULT 'RASCUNHO',
    "hash" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhDocumentTemplate_tenantId_name_key" ON "RhDocumentTemplate"("tenantId", "name");
CREATE INDEX "RhDocumentTemplate_tenantId_isActive_idx" ON "RhDocumentTemplate"("tenantId", "isActive");
CREATE INDEX "RhDocument_tenantId_status_createdAt_idx" ON "RhDocument"("tenantId", "status", "createdAt");
CREATE INDEX "RhDocument_tenantId_employeeId_idx" ON "RhDocument"("tenantId", "employeeId");

ALTER TABLE "RhDocumentTemplate" ADD CONSTRAINT "RhDocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhDocument" ADD CONSTRAINT "RhDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhDocument" ADD CONSTRAINT "RhDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhDocument" ADD CONSTRAINT "RhDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RhDocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RhDocumentTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_doc_template_isolation" ON "RhDocumentTemplate" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_document_isolation" ON "RhDocument" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
