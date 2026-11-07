# WMS Production Role Migration Plan

## Current role
- postgres (via pooler) — superuser, BYPASSRLS. RLS not enforced at DB level.

## Recommended role
- app_runtime: NOSUPERUSER, NOBYPASSRLS, minimal table/sequence/function privileges.

## Migration steps
1. Backup production.
2. Create app_runtime role in Supabase.
3. Grant USAGE on public schema; SELECT/INSERT/UPDATE/DELETE on app tables; USAGE/SELECT on sequences.
4. Update DATABASE_URL to use app_runtime (keep DIRECT_URL for migrations).
5. Deploy; smoke-test endpoints.
6. Verify RLS enforcement with two-tenant test.

## Rollback
- Revert DATABASE_URL to postgres role.
- Drop app_runtime if needed.

## Risks
- Missing grants cause permission errors; test in staging first.
- Migration role must retain DDL privileges.
