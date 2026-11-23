-- A3: General Ledger (partidas dobradas) — Minimal viable GL with balance validation.
-- Auto-post integration happens via service calls; this migration only sets up storage.

CREATE TABLE "GlAccount" (
    "id"          TEXT          NOT NULL,
    "tenantId"    TEXT          NOT NULL,
    "code"        TEXT          NOT NULL,
    "name"        TEXT          NOT NULL,
    "kind"        TEXT          NOT NULL,
    "parentId"    TEXT,
    "isActive"    BOOLEAN       NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "GlAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlAccount_tenantId_id_key" ON "GlAccount"("tenantId", "id");
CREATE UNIQUE INDEX "GlAccount_tenantId_code_key" ON "GlAccount"("tenantId", "code");
CREATE INDEX "GlAccount_tenantId_kind_idx" ON "GlAccount"("tenantId", "kind");
CREATE INDEX "GlAccount_tenantId_parentId_idx" ON "GlAccount"("tenantId", "parentId");

ALTER TABLE "GlAccount"
    ADD CONSTRAINT "GlAccount_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GlAccount"
    ADD CONSTRAINT "GlAccount_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "GlAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "JournalEntry" (
    "id"           TEXT          NOT NULL,
    "tenantId"     TEXT          NOT NULL,
    "number"       TEXT          NOT NULL,
    "postedOnDate" DATE          NOT NULL,
    "description"  TEXT          NOT NULL,
    "source"       TEXT,
    "sourceId"     TEXT,
    "createdBy"    TEXT,
    "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JournalEntry_tenantId_id_key" ON "JournalEntry"("tenantId", "id");
CREATE UNIQUE INDEX "JournalEntry_tenantId_number_key" ON "JournalEntry"("tenantId", "number");
CREATE INDEX "JournalEntry_tenantId_postedOnDate_idx" ON "JournalEntry"("tenantId", "postedOnDate");
CREATE INDEX "JournalEntry_tenantId_source_sourceId_idx" ON "JournalEntry"("tenantId", "source", "sourceId");

ALTER TABLE "JournalEntry"
    ADD CONSTRAINT "JournalEntry_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JournalEntryLine" (
    "id"         TEXT          NOT NULL,
    "tenantId"   TEXT          NOT NULL,
    "entryId"    TEXT          NOT NULL,
    "accountId"  TEXT          NOT NULL,
    "debit"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit"     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "memo"       TEXT,

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalEntryLine_tenantId_accountId_idx" ON "JournalEntryLine"("tenantId", "accountId");
CREATE INDEX "JournalEntryLine_tenantId_entryId_idx" ON "JournalEntryLine"("tenantId", "entryId");

ALTER TABLE "JournalEntryLine"
    ADD CONSTRAINT "JournalEntryLine_entry_tenant_fkey"
    FOREIGN KEY ("tenantId", "entryId") REFERENCES "JournalEntry"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalEntryLine"
    ADD CONSTRAINT "JournalEntryLine_account_tenant_fkey"
    FOREIGN KEY ("tenantId", "accountId") REFERENCES "GlAccount"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
