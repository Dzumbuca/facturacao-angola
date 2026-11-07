# WMS Production Migration Package

## Package contents
1. Diagnosis: prod uses postgres role (superuser, BYPASSRLS); RLS not enforced at DB level.
2. Risks: cross-tenant data exposure if app-level filtering fails.
3. Recommended role: app_runtime (NOSUPERUSER, NOBYPASSRLS, minimal privileges).
4. Grants: USAGE on public schema; SELECT/INSERT/UPDATE/DELETE on app tables; USAGE/SELECT on sequences.
5. Connection string changes: DATABASE_URL → app_runtime; DIRECT_URL remains migration role.
6. Migration sequence: backup → create role → grants → update DATABASE_URL → deploy → smoke test.
7. Backup strategy: pg_dump -Fc before any change.
8. Pre-change tests: tenant isolation with app_runtime in staging.
9. Post-change tests: endpoint smoke, RLS verification, two-tenant isolation.
10. Rollback: revert DATABASE_URL to postgres; drop app_runtime if needed.
11. Recovery: restore from backup.
12. Completion criteria: all endpoints functional, RLS enforced, no permission errors.

## Status
Package documented only. No prod changes made. Requires production authorization.
