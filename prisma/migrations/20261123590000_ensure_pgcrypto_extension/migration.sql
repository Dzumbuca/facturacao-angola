-- Ensure pgcrypto extension is available for gen_random_uuid()
-- Required by A12 (AuditEvent) and A13 (ApprovalRequest, EmissionLease)
-- which use gen_random_uuid()::text as primary key default.
-- PostgreSQL 13+ includes gen_random_uuid() natively; earlier versions
-- require the pgcrypto extension. CREATE EXTENSION IF NOT EXISTS is
-- idempotent and safe to re-execute.
-- Placed before A12 (20261124000000) so the extension exists before
-- any migration that depends on gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS pgcrypto;
