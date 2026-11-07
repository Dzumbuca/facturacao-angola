# WMS Supabase RLS Role Final Report

## Role audit
- app_lowpriv created in staging: NOSUPERUSER, NOBYPASSRLS. Granted USAGE on schema, SELECT/INSERT/UPDATE/DELETE on all tables, USAGE/SELECT on sequences.
- Tested with two tenants: isolation confirmed (each sees only own data; fail-closed without context; no leak).

## Plan for production
- Create dedicated app role (no BYPASSRLS) in Supabase; keep migration role separate.
- Update DATABASE_URL to app role; DIRECT_URL stays migration role.
- Validate RLS enforcement; rollback by reverting DATABASE_URL.

## Status
Plan documented. No prod changes made.
