-- RLS auth executor prototype (LOCAL TEST DB 5437 ONLY). DO NOT run in production.
-- Aligns with RLS_ROLE_DESIGN.md/RLS_NEXTAUTH_PROTOTYPE_REPORT.md: keep Account/Session/VerificationToken/EmailActionToken
-- WITHOUT generic tenant RLS in staging until compatible auth policies/executor path is validated end-to-end.
-- EmailRequestLimit is admin/global (rate-limit infra) per RLS_POLICIES_STAGING.sql; User has tenant/self/admin policy.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Account') THEN ALTER TABLE "Account" DISABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Session') THEN ALTER TABLE "Session" DISABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='VerificationToken') THEN ALTER TABLE "VerificationToken" DISABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='EmailActionToken') THEN ALTER TABLE "EmailActionToken" DISABLE ROW LEVEL SECURITY; END IF;
END $$;
-- Grants: mf_auth_executor keeps minimal DML on auth tables only (see scripts/rls-staging-roles.sql). Re-apply roles SQL if needed.
