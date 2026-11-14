-- Machine RH — credencial de PIN do ponto (Opção B)
-- pinLookup: SHA-256 do PIN + pepper da app (permite detecção de duplicados
-- e unicidade sem expor o PIN). pinChangedAt: data da última alteração.

ALTER TABLE "RhEmployee"
  ADD COLUMN IF NOT EXISTS "pinLookup" TEXT;

ALTER TABLE "RhEmployee"
  ADD COLUMN IF NOT EXISTS "pinChangedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "RhEmployee_tenantId_pinLookup_key"
  ON "RhEmployee"("tenantId", "pinLookup")
  WHERE "pinLookup" IS NOT NULL;
