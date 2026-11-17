-- A12: financial audit log
CREATE TABLE "AuditEvent" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"       TEXT NOT NULL,
  "actorUserId"    TEXT,
  "action"         TEXT NOT NULL,
  "entity"         TEXT NOT NULL,
  "entityId"       TEXT,
  "before"         JSONB,
  "after"          JSONB,
  "justification"  TEXT,
  "result"         TEXT NOT NULL DEFAULT 'SUCCESS',
  "correlationId"  TEXT,
  "source"         TEXT,
  "occurredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditEvent_tenantId_occurredAt_idx" ON "AuditEvent"("tenantId", "occurredAt" DESC);
CREATE INDEX "AuditEvent_tenantId_entity_entityId_idx" ON "AuditEvent"("tenantId", "entity", "entityId");
CREATE INDEX "AuditEvent_tenantId_action_idx" ON "AuditEvent"("tenantId", "action");
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE;

-- A12: distributed semaphore table for tenant emission capacity
CREATE TABLE "DistributedSlot" (
  "tenantId"   TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "inflight"   INTEGER  NOT NULL DEFAULT 0 CHECK ("inflight" >= 0),
  "maxSlots"   INTEGER  NOT NULL DEFAULT 2 CHECK ("maxSlots" >= 1),
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DistributedSlot_updatedAt_idx" ON "DistributedSlot"("updatedAt");
