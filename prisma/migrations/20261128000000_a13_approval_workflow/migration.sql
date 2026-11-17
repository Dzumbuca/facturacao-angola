-- A13 — Approval workflow for critical financial operations
CREATE TABLE "ApprovalRequest" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL,
  "operation"       TEXT NOT NULL,
  "entityType"      TEXT NOT NULL,
  "entityId"        TEXT NOT NULL,
  "payload"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "requestedBy"     TEXT NOT NULL,
  "requesterRole"   TEXT,
  "justification"   TEXT NOT NULL,
  "state"           TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED','EXECUTED','FAILED')),
  "decidedBy"       TEXT,
  "decidedAt"       TIMESTAMP(3),
  "decision"        TEXT CHECK ("decision" IS NULL OR "decision" IN ('APPROVED','REJECTED','CANCELLED')),
  "decisionReason"  TEXT,
  "executedAt"      TIMESTAMP(3),
  "executedSummary" JSONB,
  "correlationId"   TEXT,
  "expiresAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- tenant-aware
ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE;

-- request must not have multiple PENDING entries for same (tenant, operation, entityId)
CREATE UNIQUE INDEX "ApprovalRequest_tenant_operation_entity_pending_uidx"
  ON "ApprovalRequest"("tenantId", "operation", "entityId")
  WHERE state = 'PENDING';

CREATE INDEX "ApprovalRequest_tenant_state_idx"     ON "ApprovalRequest"("tenantId", "state", "createdAt" DESC);
CREATE INDEX "ApprovalRequest_tenant_requestedBy_idx" ON "ApprovalRequest"("tenantId", "requestedBy", "createdAt" DESC);
CREATE INDEX "ApprovalRequest_correlationId_idx"     ON "ApprovalRequest"("correlationId");

-- Leases for distributed FT emission (replaces DistributedSlot with per-operation leases)
CREATE TABLE "EmissionLease" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "operationId"   TEXT NOT NULL,
  "processId"     TEXT,
  "state"         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("state" IN ('ACTIVE','RELEASED','EXPIRED')),
  "acquiredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "lastRenewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt"    TIMESTAMP(3)
);
CREATE UNIQUE INDEX "EmissionLease_tenant_operation_active_uidx"
  ON "EmissionLease"("tenantId", "operationId")
  WHERE state = 'ACTIVE';
CREATE INDEX "EmissionLease_tenant_state_idx" ON "EmissionLease"("tenantId", "state", "acquiredAt");
CREATE INDEX "EmissionLease_expiresAt_idx"     ON "EmissionLease"("expiresAt");
ALTER TABLE "EmissionLease"
  ADD CONSTRAINT "EmissionLease_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE;
