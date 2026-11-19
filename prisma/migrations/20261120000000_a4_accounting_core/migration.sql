-- A4: Núcleo contabilístico — exercícios, períodos, contadores, estornos, histórico, contadores transaccionais
ALTER TABLE "GlAccount" ADD COLUMN "synthetic"   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "GlAccount" ADD COLUMN "nature"      TEXT;

CREATE INDEX "GlAccount_tenantId_synthetic_kind" ON "GlAccount"("tenantId", "synthetic", "kind");

CREATE TABLE "GlAccountHistory" (
  "id"           TEXT          NOT NULL,
  "tenantId"     TEXT          NOT NULL,
  "accountId"    TEXT          NOT NULL,
  "action"       TEXT          NOT NULL,
  "actorUserId"  TEXT,
  "changedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "oldValues"    JSONB,
  "newValues"    JSONB,
  CONSTRAINT "GlAccountHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GlAccountHistory_tenantId_accountId_idx" ON "GlAccountHistory"("tenantId", "accountId");
ALTER TABLE "GlAccountHistory"
  ADD CONSTRAINT "GlAccountHistory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountingExercise" (
  "id"           TEXT          NOT NULL,
  "tenantId"     TEXT          NOT NULL,
  "year"         INTEGER       NOT NULL,
  "startDate"    DATE          NOT NULL,
  "endDate"      DATE          NOT NULL,
  "state"        TEXT          NOT NULL DEFAULT 'OPEN',
  "openedAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedBy"     TEXT,
  "closedAt"     TIMESTAMP(3),
  "closedBy"     TEXT,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingExercise_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingExercise_year_check" CHECK ("year" >= 1900 AND "year" <= 2999),
  CONSTRAINT "AccountingExercise_dates_check" CHECK ("startDate" <= "endDate")
);

CREATE UNIQUE INDEX "AccountingExercise_tenantId_id_key" ON "AccountingExercise"("tenantId", "id");
CREATE UNIQUE INDEX "AccountingExercise_tenantId_year_key" ON "AccountingExercise"("tenantId", "year");
CREATE INDEX "AccountingExercise_tenantId_state_idx" ON "AccountingExercise"("tenantId", "state");

ALTER TABLE "AccountingExercise"
  ADD CONSTRAINT "AccountingExercise_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountingPeriod" (
  "id"           TEXT          NOT NULL,
  "tenantId"     TEXT          NOT NULL,
  "exerciseId"   TEXT          NOT NULL,
  "code"         TEXT          NOT NULL,
  "startDate"    DATE          NOT NULL,
  "endDate"      DATE          NOT NULL,
  "state"        TEXT          NOT NULL DEFAULT 'OPEN',
  "openedAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedBy"     TEXT,
  "closedAt"     TIMESTAMP(3),
  "closedBy"     TEXT,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingPeriod_dates_check" CHECK ("startDate" <= "endDate")
);

CREATE UNIQUE INDEX "AccountingPeriod_tenantId_id_key" ON "AccountingPeriod"("tenantId", "id");
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_exerciseId_code_key" ON "AccountingPeriod"("tenantId", "exerciseId", "code");
CREATE INDEX "AccountingPeriod_tenantId_state_idx" ON "AccountingPeriod"("tenantId", "state");
CREATE INDEX "AccountingPeriod_tenantId_dates_idx" ON "AccountingPeriod"("tenantId", "startDate", "endDate");

ALTER TABLE "AccountingPeriod"
  ADD CONSTRAINT "AccountingPeriod_exercise_tenant_fkey"
  FOREIGN KEY ("tenantId", "exerciseId") REFERENCES "AccountingExercise"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountingSequence" (
  "id"           TEXT          NOT NULL,
  "tenantId"     TEXT          NOT NULL,
  "prefix"       TEXT          NOT NULL,
  "nextNumber"   INTEGER       NOT NULL DEFAULT 1,
  CONSTRAINT "AccountingSequence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingSequence_nextNumber_positive" CHECK ("nextNumber" >= 1)
);

CREATE UNIQUE INDEX "AccountingSequence_tenantId_prefix_key" ON "AccountingSequence"("tenantId", "prefix");

ALTER TABLE "AccountingSequence"
  ADD CONSTRAINT "AccountingSequence_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vincular JournalEntry a exercícios/períodos e garantir rastreabilidade
ALTER TABLE "JournalEntry" ADD COLUMN "exerciseId" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "periodId"   TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "entryType"  TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "JournalEntry" ADD COLUMN "status"     TEXT NOT NULL DEFAULT 'POSTED';
ALTER TABLE "JournalEntry" ADD COLUMN "reversedFromId" TEXT;

CREATE INDEX "JournalEntry_tenantId_exerciseId_idx" ON "JournalEntry"("tenantId", "exerciseId");
CREATE INDEX "JournalEntry_tenantId_periodId_idx" ON "JournalEntry"("tenantId", "periodId");
CREATE INDEX "JournalEntry_tenantId_status_idx" ON "JournalEntry"("tenantId", "status");
CREATE UNIQUE INDEX "JournalEntry_tenantId_reversedFromId_key" ON "JournalEntry"("tenantId", "reversedFromId") WHERE "reversedFromId" IS NOT NULL;
