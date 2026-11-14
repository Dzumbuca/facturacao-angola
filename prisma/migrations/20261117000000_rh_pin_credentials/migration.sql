-- Machine RH — credencial de PIN do ponto
-- pinLookup: HMAC-SHA256(pin + PIN_PEPPER) — permite detectar duplicados
-- sem guardar nem expor o PIN. pinChangedAt: data da última alteração.
-- Aditivo: apenas adiciona colunas e o índice único (não afecta dados existentes).

ALTER TABLE "RhEmployee"
  ADD COLUMN IF NOT EXISTS "pinLookup" TEXT;

ALTER TABLE "RhEmployee"
  ADD COLUMN IF NOT EXISTS "pinChangedAt" TIMESTAMP(3);

-- Índice único composto (tenantId, pinLookup).
-- PostgreSQL permite múltiplos NULL em índices únicos, logo funcionários legados
-- (pinLookup NULL) podem coexistir sem violar a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "RhEmployee_tenantId_pinLookup_key"
  ON "RhEmployee"("tenantId", "pinLookup");
