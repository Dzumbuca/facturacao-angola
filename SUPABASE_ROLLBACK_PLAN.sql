-- SUPABASE_ROLLBACK_PLAN.sql (PREPARED DRAFT — DO NOT RUN BLINDLY)
-- Machine Facturas / Supabase rollback guidance
-- Preferred rollback for production incidents: restore verified backup/snapshot within approved RPO/RTO.
-- SQL rollback below is PARTIAL and must be adapted to the exact migration step applied.

\echo 'STOP: Preferred rollback is snapshot/backup restore. Use SQL rollback only for reviewed, limited steps.'

-- =========================
-- 0. INCIDENT DECISION
-- =========================
-- Stop migration if: login/NextAuth broken, invoicing/critical writes fail, cross-tenant leak suspected,
-- admin lockout, or inability to validate. Escalate to responsible owner.

-- =========================
-- 1. POLICIES (reverse of specific policy changes)
-- =========================
-- DROP POLICY IF EXISTS <policy_name> ON public."<Table>";
-- Recreate prior known-good policy only from approved backup/source of truth.

-- =========================
-- 2. FORCE RLS (only if FORCE caused breakage and role model understood)
-- =========================
-- ALTER TABLE public."<Table>" NO FORCE ROW LEVEL SECURITY;

-- =========================
-- 3. RLS ENABLE (dangerous to disable broadly; prefer restore)
-- =========================
-- ALTER TABLE public."<Table>" DISABLE ROW LEVEL SECURITY; -- ONLY for reviewed emergency on specific table

-- =========================
-- 4. GRANTS (restore minimal service)
-- =========================
-- Re-grant only what is necessary to restore app, following least privilege and incident scope.
-- GRANT USAGE ON SCHEMA public TO <APP_ROLE>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public."<Table>" TO <APP_ROLE>;

-- =========================
-- 5. ROLE FLAGS (EXTREME CAUTION — requires separate approval)
-- =========================
-- Do NOT re-enable SUPERUSER/BYPASSRLS casually. If temporarily required for emergency restore,
-- document approval, scope, time window, and immediate remediation plan.

-- =========================
-- 6. VALIDATION AFTER ROLLBACK
-- =========================
-- Verify auth, tenant isolation, invoicing, stock, payments, admin. Confirm no unintended public exposure.

\echo 'END OF ROLLBACK DRAFT.'
