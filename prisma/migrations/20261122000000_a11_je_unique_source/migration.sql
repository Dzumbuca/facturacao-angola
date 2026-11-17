-- A11: prevent duplicate journal entries for the same (tenant, source, sourceId)
CREATE UNIQUE INDEX "JournalEntry_tenantId_source_sourceId_uidx"
  ON "JournalEntry" ("tenantId", "source", "sourceId")
  WHERE "source" IS NOT NULL AND "sourceId" IS NOT NULL;
