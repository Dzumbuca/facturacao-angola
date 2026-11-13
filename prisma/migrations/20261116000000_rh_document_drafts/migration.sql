CREATE TYPE "RhDocumentDraftStatus" AS ENUM ('EM_EDICAO', 'AGUARDANDO_REVISAO', 'REVISTO', 'APROVADO');

CREATE TABLE "RhDocumentDraft" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "RhDocumentDraftStatus" NOT NULL DEFAULT 'EM_EDICAO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RhDocumentDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RhDocumentDraft_tenantId_userId_createdAt_idx" ON "RhDocumentDraft"("tenantId", "userId", "createdAt");
CREATE INDEX "RhDocumentDraft_tenantId_category_idx" ON "RhDocumentDraft"("tenantId", "category");

ALTER TABLE "RhDocumentDraft" ADD CONSTRAINT "RhDocumentDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
