# RLS_SUPABASE_POOLING_COMPATIBILITY

**Status:** **NOT VALIDATED** on Supabase PostgreSQL/PgBouncer (no authorized equivalent test target used in this phase).

## Current Design
- `src/lib/tenant-db.ts` uses `runWithTenant(tenantId, fn(tx), {userId,isAdmin})` and executes:
  - `SELECT set_config('app.tenant_id', $1, true)`
  - `SELECT set_config('app.user_id', $2, true)` (or empty)
  - `SELECT set_config('app.is_admin', $3, true)`
  inside the **same Prisma transaction** (`$transaction`). `true` = transaction-local GUC.

## Compatibility Assessment (theoretical)
- **Transaction-local `set_config(..., true)` is the right primitive** for PgBouncer transaction pooling, because GUCs reset at transaction end. This avoids session-level leaks across pooled connections *if every tenant-scoped query runs inside that transaction and policies read `current_setting(..., true)`*.
- **Risks to validate:**
  1. Any query executed outside `runWithTenant`/transaction (global Prisma singleton) will not carry tenant GUCs; under RLS+NOBYPASSRLS it may fail or return empty depending on policy.
  2. Long transactions, retries, or interleaved async work must not escape the tx boundary.
  3. Supabase pooler modes/connection strings (transaction vs session) and Prisma connection behavior must be tested; session pooling would require different guarantees.
  4. `FORCE ROW LEVEL SECURITY`, table owners, role membership, and BYPASSRLS attributes differ in managed environments.
  5. Auth adapter/global admin/cron paths need dedicated executor strategy compatible with pooling.

## Required Validation (before production claim)
- Run equivalent RLS tests on an **authorized Supabase staging/test project** (not production) using the same pooler mode intended for production.
- Verify transaction-local GUC visibility, no cross-request leakage, and behavior of global Prisma/auth/admin paths.
- Confirm Prisma + Supabase connection URL configuration and prepared statement/pooling constraints.

## Conclusion
Design is directionally compatible with transaction pooling, but **compatibility is unproven**. Do not claim Supabase/PgBouncer readiness.
