-- Read-only assertions to run after applying 20261027180000_public_api_security.
-- Default ACL checks below are scoped to the Prisma migration role (current_user).
DO $verify$
DECLARE
  missing_rls TEXT;
  exposed_table TEXT;
  exposed_sequence TEXT;
  exposed_function TEXT;
  exposed_default TEXT;
  exposed_schema_access TEXT;
BEGIN
  IF has_schema_privilege('anon', 'public', 'USAGE')
     OR has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'USAGE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    exposed_schema_access := 'anon/authenticated retain public schema access';
    RAISE EXCEPTION '%', exposed_schema_access;
  END IF;

  IF NOT has_schema_privilege('service_role', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'Trusted service_role lost USAGE on the public schema';
  END IF;

  SELECT string_agg(format('%I', c.relname), ', ' ORDER BY c.relname)
  INTO missing_rls
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;

  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is disabled on public tables: %', missing_rls;
  END IF;

  SELECT string_agg(format('%I to %I', c.relname, role_name), ', ' ORDER BY c.relname, role_name)
  INTO exposed_table
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(role_name)
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND (
      has_table_privilege(role_name, c.oid, 'SELECT')
      OR has_table_privilege(role_name, c.oid, 'INSERT')
      OR has_table_privilege(role_name, c.oid, 'UPDATE')
      OR has_table_privilege(role_name, c.oid, 'DELETE')
      OR has_table_privilege(role_name, c.oid, 'TRUNCATE')
      OR has_table_privilege(role_name, c.oid, 'REFERENCES')
      OR has_table_privilege(role_name, c.oid, 'TRIGGER')
      OR has_table_privilege(role_name, c.oid, 'MAINTAIN')
      OR has_any_column_privilege(role_name, c.oid, 'SELECT')
      OR has_any_column_privilege(role_name, c.oid, 'INSERT')
      OR has_any_column_privilege(role_name, c.oid, 'UPDATE')
      OR has_any_column_privilege(role_name, c.oid, 'REFERENCES')
    );

  IF exposed_table IS NOT NULL THEN
    RAISE EXCEPTION 'Public API roles still have public table privileges: %', exposed_table;
  END IF;

  SELECT string_agg(format('%I to %I', p.proname, role_name), ', ' ORDER BY p.proname, role_name)
  INTO exposed_function
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(role_name)
  WHERE n.nspname = 'public'
    AND has_function_privilege(role_name, p.oid, 'EXECUTE');

  IF exposed_function IS NOT NULL THEN
    RAISE EXCEPTION 'Public API roles can still execute public functions: %', exposed_function;
  END IF;

  SELECT string_agg(format('%I to %I', c.relname, role_name), ', ' ORDER BY c.relname, role_name)
  INTO exposed_sequence
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(role_name)
  WHERE n.nspname = 'public' AND c.relkind = 'S'
    AND (has_sequence_privilege(role_name, c.oid, 'USAGE')
      OR has_sequence_privilege(role_name, c.oid, 'SELECT')
      OR has_sequence_privilege(role_name, c.oid, 'UPDATE'));

  IF exposed_sequence IS NOT NULL THEN
    RAISE EXCEPTION 'Public API roles still have public sequence privileges: %', exposed_sequence;
  END IF;

  SELECT string_agg(format('%I default grants to %I', owner_role.rolname, grantee_role.rolname), ', ')
  INTO exposed_default
  FROM pg_default_acl AS d
  LEFT JOIN pg_namespace AS n ON n.oid = d.defaclnamespace
  JOIN pg_roles AS owner_role ON owner_role.oid = d.defaclrole
  CROSS JOIN LATERAL aclexplode(d.defaclacl) AS acl
  LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = acl.grantee
  WHERE (d.defaclnamespace = 0 OR n.nspname = 'public')
    AND d.defaclobjtype IN ('r', 'S', 'f')
    AND d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
    AND (acl.grantee = 0 OR grantee_role.rolname IN ('anon', 'authenticated'));

  IF exposed_default IS NOT NULL THEN
    RAISE EXCEPTION 'Public API roles still have default privileges for public objects: %', exposed_default;
  END IF;
END
$verify$;

SELECT 'RLS enabled; anon/authenticated lack public schema/object access, and Prisma-role defaults are revoked.' AS verification_result;
