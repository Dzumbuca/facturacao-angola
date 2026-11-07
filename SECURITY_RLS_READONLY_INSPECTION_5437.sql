-- READ-ONLY inspection bundle for authorized target ONLY:
-- Host 127.0.0.1, Port 5437, Database mf_rls_staging
-- Do not run against any other target. No DDL/DML.

-- 1) Target confirmation
SELECT current_database() AS db, inet_server_addr()::text AS server_addr, inet_server_port() AS server_port, current_user, session_user, version();

-- 2) Tables (public + relevant schemas), RLS flags, owner
SELECT n.nspname AS schema, c.relname AS table_name, c.relkind,
  c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND c.relkind IN ('r','p')
ORDER BY n.nspname, c.relname;

-- 3) Focus tables
SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('Account','Session','VerificationToken','EmailActionToken');

-- 4) Policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, policyname;

-- 5) Roles / BYPASSRLS / SUPERUSER (metadata only)
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb, rolinherit
FROM pg_roles ORDER BY rolname;

-- 6) Table privileges (effective for common app roles if present)
SELECT table_schema, table_name, grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema='public'
ORDER BY table_name, grantee, privilege_type;

-- 7) Column-level grants (sensitive)
SELECT table_schema, table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public'
ORDER BY table_name, column_name, grantee, privilege_type;

-- 8) Default privileges
SELECT pg_get_userbyid(d.defaclrole) AS owner, n.nspname AS schema, d.defaclobjtype, d.defaclacl::text
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
ORDER BY 1,2,3;

-- 9) GUC/policy text clues in functions/views not needed; policies captured above.
-- 10) Compare output against SECURITY_RLS_MATRIX.md.
