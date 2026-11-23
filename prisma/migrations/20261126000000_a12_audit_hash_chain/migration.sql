-- A12 — AuditEvent hash chain (per tenant)
ALTER TABLE "AuditEvent"
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "hash"         TEXT;

CREATE UNIQUE INDEX "AuditEvent_tenantId_hash_uidx"
  ON "AuditEvent"("tenantId", "hash");
