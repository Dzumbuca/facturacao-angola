-- RLS staging roles for Machine Facturas (LOCAL TEST DB ONLY: 127.0.0.1:5437/mf_rls_staging)
-- DO NOT run in Supabase production. Do NOT use production credentials.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mf_app_nobypass') THEN
    CREATE ROLE mf_app_nobypass NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mf_migration') THEN
    CREATE ROLE mf_migration NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mf_admin_executor') THEN
    CREATE ROLE mf_admin_executor NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mf_auth_executor') THEN
    CREATE ROLE mf_auth_executor NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
GRANT CONNECT ON DATABASE mf_rls_staging TO mf_app_nobypass, mf_migration, mf_admin_executor, mf_auth_executor;
GRANT USAGE ON SCHEMA public TO mf_app_nobypass, mf_migration, mf_admin_executor, mf_auth_executor;
GRANT CREATE ON SCHEMA public TO mf_migration;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mf_migration;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mf_migration;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mf_app_nobypass;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mf_app_nobypass;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mf_admin_executor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mf_admin_executor;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "User","Account","Session","VerificationToken","EmailActionToken","EmailRequestLimit" TO mf_auth_executor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mf_auth_executor;
GRANT mf_app_nobypass, mf_migration, mf_admin_executor, mf_auth_executor TO postgres;
