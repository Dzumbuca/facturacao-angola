-- Read-only preflight. Run against the intended Supabase project before
-- applying 20261027180000_public_api_security.

SELECT current_database() AS database_name, current_user AS effective_role, session_user AS login_role;

SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
FROM pg_roles
WHERE rolname = current_user OR rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY rolname;

SELECT
  c.relname AS table_name,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls,
  (SELECT r.rolsuper OR r.rolbypassrls FROM pg_roles AS r WHERE r.oid = c.relowner) AS owner_bypasses_rls,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
  has_table_privilege('service_role', c.oid, 'SELECT') AS service_role_select
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY c.relname;

SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('Account', 'CompanyBankAccount', 'Tenant', 'User', 'VerificationToken')
  AND column_name IN ('access_token', 'refresh_token', 'iban', 'password', 'token')
ORDER BY table_name, column_name, grantee, privilege_type;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

SELECT
  c.relname AS view_name,
  c.reloptions
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
ORDER BY c.relname;
