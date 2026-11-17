-- A6: Reconciliation tables for cross-document audit trace
CREATE TABLE "ReconciliationRun" (
  "id"           TEXT          NOT NULL,
  "tenantId"     TEXT          NOT NULL,
  "startedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"   TIMESTAMP(3),
  "status"       TEXT          NOT NULL DEFAULT 'RUNNING',
  "rulesClaimed" INTEGER       NOT NULL DEFAULT 0,
  "issuesFound"  INTEGER       NOT NULL DEFAULT 0,
  "actorUserId"  TEXT,
  CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconciliationRun_tenantId_id_key" ON "ReconciliationRun"("tenantId", "id");
CREATE INDEX "ReconciliationRun_tenantId_startedAt_idx" ON "ReconciliationRun"("tenantId", "startedAt");
CREATE INDEX "ReconciliationRun_tenantId_status_idx" ON "ReconciliationRun"("tenantId", "status");

ALTER TABLE "ReconciliationRun"
  ADD CONSTRAINT "ReconciliationRun_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReconciliationIssue" (
  "id"           TEXT          NOT NULL,
  "tenantId"     TEXT          NOT NULL,
  "runId"        TEXT          NOT NULL,
  "issueType"    TEXT          NOT NULL,
  "docKind"      TEXT,
  "docId"        TEXT,
  "value"        DECIMAL(12,2),
  "description"  TEXT          NOT NULL,
  "severity"     TEXT          NOT NULL DEFAULT 'MEDIUM',
  "state"        TEXT          NOT NULL DEFAULT 'OPEN',
  "resolvedAt"   TIMESTAMP(3),
  "resolvedBy"   TEXT,
  "justification" TEXT,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconciliationIssue_tenantId_runId_idx" ON "ReconciliationIssue"("tenantId", "runId");
CREATE INDEX "ReconciliationIssue_tenantId_state_idx" ON "ReconciliationIssue"("tenantId", "state");
CREATE INDEX "ReconciliationIssue_tenantId_issueType_idx" ON "ReconciliationIssue"("tenantId", "issueType");

ALTER TABLE "ReconciliationIssue"
  ADD CONSTRAINT "ReconciliationIssue_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReconciliationIssue"
  ADD CONSTRAINT "ReconciliationIssue_runId_fkey"
  FOREIGN KEY ("tenantId", "runId") REFERENCES "ReconciliationRun"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
