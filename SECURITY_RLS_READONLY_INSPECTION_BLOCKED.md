# SECURITY RLS READ-ONLY INSPECTION REPORT (BLOCKED)
Date: 2026-11-07
Authorized target (explicit): `127.0.0.1:5437/mf_rls_staging` (READ-ONLY only)
Project: `C:\Users\Administrador\Desktop\facturacao-angola`, branch `wms-v2-e2e-staging`

## Pre-execution safety checks (performed, no credentials exposed)
- Confirmed Node `pg` client available locally (`pg ok`).
- Scanned env files for target metadata only (host/port/database/key names), no values printed:
  - `.env` / `.env.local` / `.env.playwright`: point to `127.0.0.1:5436/wms_staging` (NOT authorized target).
  - `.env.staging`: points to `aws-0-eu-west-1.pooler.supabase.com:6543/postgres` (NOT authorized target).
  - `.env.example`: placeholders.
  - No env key found with `targetMatches=true` for `127.0.0.1:5437/mf_rls_staging`.
- `docker-compose.test.yml` maps local Postgres to `5437:5432` but service DB is `machine_stock_test` (different database name) — not the authorized `mf_rls_staging` target. **No connection attempted**.

## Execution status
**BLOCKED — authorized DB target/credentials not safely confirmed.** I did not connect, did not run any SQL against any database, and did not read/expose credentials.

## Prepared artifact (read-only, for authorized execution)
- `SECURITY_RLS_READONLY_INSPECTION_5437.sql` — read-only inspection bundle limited to metadata: target confirmation, table RLS/FORCE/owners, focus tables (Account/Session/VerificationToken/EmailActionToken), policies, roles/bypassrls metadata, table/column grants, default privileges.

## Required to proceed
Provide a connection method that resolves **exactly** to `127.0.0.1:5437/mf_rls_staging` (or an approved env var name already present in the shell/session) without exposing secrets in chat logs. After target confirmation query returns that exact db/host/port, I can run only the read-only bundle and update reports with real evidence.

## Items still not confirmed (live)
- Number of tables inspected: **0 (blocked)**.
- Number of policies found: **unknown live**.
- RLS enabled/FORCE RLS per table: **unknown live**.
- Owners, BYPASSRLS/superuser, effective grants/REVOKE state: **unknown live**.
- GUCs actually enforced by live policies: **unknown live** (repo SQL uses `app.tenant_id/app.user_id/app.is_admin`).
- Divergences documentation vs DB: **not assessable live**.
