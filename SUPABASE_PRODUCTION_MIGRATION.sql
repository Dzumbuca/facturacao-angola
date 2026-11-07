-- SUPABASE_PRODUCTION_MIGRATION.sql (PREPARED DRAFT — DO NOT RUN IN PRODUCTION)
-- Machine Facturas / Supabase PostgreSQL hardening
-- Status: PREPARED FOR REVIEW ONLY. NOT EXECUTED.
-- REQUIRED BEFORE ANY USE:
--   1) "autoriza produção" explícita + alvo confirmado (project ref/host/db) + janela + responsável
--   2) Backup/snapshot recente verificado + rollback testado/viável
--   3) Confirmar role Prisma real da app, owners, estado RLS/grants/policies NO ALVO
--   4) Testes de regressão/isolamento aprovados em staging representativo
--   5) Adaptar placeholders <APP_ROLE>, <MIGRATION_ROLE>, <SCHEMA_OWNER> ao ambiente real
--
-- SAFETY: aborta se executado como role sem privilégios esperados ou se alvo não for confirmado
-- pelo operador (mecanismo processual; SQL não conhece intenção humana).

\echo 'STOP: This script is a prepared draft. Review, adapt placeholders, and obtain production authorization before execution.'

-- =========================
-- A. PREFLIGHT (read-only checks; safe to run in staging/target with authorization)
-- =========================
-- SELECT current_database(), current_user, session_user, inet_server_addr(), inet_server_port();
-- SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user OR rolname IN ('anon','authenticated','service_role','postgres','<APP_ROLE>') ORDER BY 1;
-- SELECT relname, relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1;
-- SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY 1,2;
-- SELECT grantee, privilege_type, table_name FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated') ORDER BY 1,3,2;

-- =========================
-- B. ROLES (template — validate Supabase managed roles before changes)
-- =========================
-- DO  BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '<APP_ROLE>') THEN
--     CREATE ROLE <APP_ROLE> NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; -- or LOGIN per target
--   END IF;
-- END ;
-- GRANT CONNECT ON DATABASE <TARGET_DB_NAME_REVIEWED> TO <APP_ROLE>;
-- GRANT USAGE ON SCHEMA public TO <APP_ROLE>;
-- -- Grant minimal DML per table after policy review; avoid blanket ALL if not needed.
-- -- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ... TO <APP_ROLE>;

-- =========================
-- C. REVOKE PUBLIC API SURFACE (idempotent where possible)
-- =========================
-- REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
-- REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
-- REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
-- REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC, anon, authenticated;
-- GRANT USAGE ON SCHEMA public TO service_role; -- validate against target
-- GRANT USAGE ON SCHEMA public TO <APP_ROLE>;

-- =========================
-- D. RLS ENABLE + POLICIES (templates; adapt per table after code/target review)
-- =========================
-- Tenant-scoped template (tables with "tenantId"):
-- ALTER TABLE public."<TenantTable>" ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tenant_isolation ON public."<TenantTable>";
-- CREATE POLICY tenant_isolation ON public."<TenantTable>"
--   FOR ALL
--   USING (current_setting('app.tenant_id', true) = "tenantId"::text)
--   WITH CHECK (current_setting('app.tenant_id', true) = "tenantId"::text);
--
-- InvoiceItem (no tenantId in schema): use parent join
-- ALTER TABLE public."InvoiceItem" ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS invoiceitem_tenant_isolation ON public."InvoiceItem";
-- CREATE POLICY invoiceitem_tenant_isolation ON public."InvoiceItem"
--   FOR ALL
--   USING (EXISTS (SELECT 1 FROM public."Invoice" i WHERE i.id = "InvoiceItem"."invoiceId" AND i."tenantId" = current_setting('app.tenant_id', true)))
--   WITH CHECK (EXISTS (SELECT 1 FROM public."Invoice" i WHERE i.id = "InvoiceItem"."invoiceId" AND i."tenantId" = current_setting('app.tenant_id', true)));
--
-- NextAuth tables (Account/Session/VerificationToken) and global/platform tables:
-- REQUIRE CASE-BY-CASE DESIGN + TESTS (risk: break login/admin). Do not apply generic tenant policy.

-- Tables flagged in staging (review/cover in target): AdUnlock, PlanApplication, PlatformApplication,
-- SubscriptionPlan, TenantApplication, TenantSubscription (no RLS in staging);
-- Account, AdminAuditLog, BusinessDocumentEvent, BusinessDocumentItem, CompanyBankAccount, CompanyLogo,
-- EmailRequestLimit, InvoiceDraft, InvoiceItem, MarketingPreference, Payment, PaymentEvent, PaymentReceipt,
-- PlanPayment, PlatformConfig, Session, VerificationToken, _prisma_migrations (RLS no policy in staging).

-- =========================
-- E. FORCE RLS (apply only after D/G/H validated; owner must not unintentionally bypass)
-- =========================
-- ALTER TABLE public."<Table>" FORCE ROW LEVEL SECURITY;
-- CAUTION: FORCE RLS affects table owner; superuser/BYPASSRLS roles may still bypass depending on role.
-- Do NOT remove BYPASSRLS from app role until FORCE+policies+grants validated.

-- =========================
-- F. FUNCTIONS/VIEWS/SEQUENCES
-- =========================
-- Review SECURITY DEFINER/search_path; REVOKE EXECUTE on sensitive functions from PUBLIC/anon/authenticated.
-- Review sequence grants for tenant data; avoid exposing counters.

-- =========================
-- G/H. POST-CHECKS (mandatory)
-- =========================
-- Run prisma/security/verify_public_api_security.sql (adapt current_user/default-privilege expectations).
-- Run app smoke tests: login/logout, NextAuth adapter ops, onboarding, invoicing, stock, payments, admin.
-- Run cross-tenant isolation tests (2+ tenants) for read/write.

\echo 'END OF PREPARED DRAFT. No production changes should be made by copying this file without review.'
