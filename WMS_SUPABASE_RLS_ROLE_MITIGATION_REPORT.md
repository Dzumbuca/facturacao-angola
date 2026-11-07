# WMS Supabase RLS Role Mitigation Report

## Current state
- App uses DATABASE_URL (postgres role via pooler) in Supabase; postgres is superuser (BYPASSRLS). RLS policies not enforced at DB level for app role.
- Local staging uses app_user (no BYPASSRLS) — RLS enforced.

## Plan (not executed in prod)
1. Create dedicated app role in Supabase with minimal privileges (SELECT/INSERT/UPDATE/DELETE on app tables, USAGE on sequences, EXECUTE on needed functions), NO BYPASSRLS, NO SUPERUSER.
2. Keep migration role separate with DDL privileges.
3. Update DATABASE_URL to use app role; DIRECT_URL remains migration role.
4. Validate RLS enforcement with two-tenant test.
5. Rollback: revert DATABASE_URL to postgres role.

## Status
Plan documented only. No prod changes made.
