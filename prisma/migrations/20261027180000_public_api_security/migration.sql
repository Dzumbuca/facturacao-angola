-- The application authenticates with NextAuth and accesses PostgreSQL only
-- through its trusted Prisma server connection. Supabase Data API roles do not
-- carry this application's identity, so no auth.uid()-based tenant policies
-- are safe here. With no policies, RLS is default-deny for roles that can read
-- tables; the explicit revokes below remove their table access entirely.
-- The server's Prisma role and service_role grants are intentionally untouched.

DO $migration$
DECLARE
  table_record RECORD;
  current_role_name TEXT := current_user;
  current_role_oid OID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Supabase API roles anon/authenticated are missing; aborting security migration';
  END IF;

  SELECT oid INTO current_role_oid FROM pg_roles WHERE rolname = current_role_name;
  -- BYPASSRLS allows data access but does not grant DDL ownership. Enabling
  -- RLS requires the migration role to be a superuser or own every table.
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE oid = current_role_oid AND rolsuper
  ) AND EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relowner <> current_role_oid
  ) THEN
    RAISE EXCEPTION 'Migration role % must be a superuser or own every public table; BYPASSRLS alone is not sufficient', current_role_name;
  END IF;

  FOR table_record IN
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'public', table_record.relname);
  END LOOP;

  -- Remove inherited/default PUBLIC grants as well as role-specific grants.
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
  REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
  REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

  -- This application does not use Supabase Auth or the Supabase Data API.
  -- Remove schema visibility as a second barrier, including for objects whose
  -- default ACLs are managed by another Supabase-owned role. Preserve access
  -- for the trusted service_role and the schema owner/Prisma role.
  REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC, anon, authenticated;
  GRANT USAGE ON SCHEMA public TO service_role;

  -- Prisma migrations create future public objects using this database role.
  -- Revoke both global and schema-specific defaults so a later table does not
  -- silently reopen the Data API. This does not modify grants to the app role.
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated',
    current_role_name
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated',
    current_role_name
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated',
    current_role_name
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated',
    current_role_name
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated',
    current_role_name
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated',
    current_role_name
  );
END
$migration$;
