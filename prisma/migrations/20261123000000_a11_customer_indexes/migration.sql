-- A11 — speed up Customer lookups used by issueInvoice under high concurrency
CREATE INDEX IF NOT EXISTS "Customer_tenantId_nif_idx" ON "Customer" ("tenantId", "nif");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_name_idx" ON "Customer" ("tenantId", "name");
