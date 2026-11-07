# RLS_COMPLETE_AUDIT_REPORT

**Date:** 2026-11-05 (local staging phase, RLS integration pass)  
**Target audited/fixed (safe scope):** `mf_rls_staging` @ `127.0.0.1:5437` only. **Production/Supabase not changed. Port 5436 not used/modified.**

## Scope Executed (real evidence)
- Inspected 5437 roles/policies/grants/RLS status and 5436 `wms_staging` read-only comparison.
- Preserved prior 5437 additive WMS/RLS setup (14 WMS tables, 47 RLS+policy relations, 4 auth adapter tables RLS-off prototype). Coverage: **51 Prisma models present, `dbOnly=0`**.
- Completed full project Prisma/RLS usage audit (API routes, auth/session/onboarding, admin, cron, financial/WMS touchpoints). Classified routes with `prisma.*` lacking obvious tenant guard into: `AUTH_EXECUTOR_REQUIRED`, `ADMIN_EXECUTOR_REQUIRED`, `CRON_EXECUTOR_REQUIRED` (`tmp/rls-api-matrix-v2.csv`, `tmp/rls-route-audit.csv`, `tmp/rls-prisma-usage.csv`).
- Implemented **minimal RLS executor integration** (no auth mechanism redesign, no RLS disabled, no production changes):
  - `src/lib/tenant-db.ts`: added `runWithRlsContext`, `runAsAdmin`, `runAsAuth` (available), `runAsSystem` — all set transaction-local GUCs (`app.tenant_id`, `app.user_id`, `app.is_admin`) via `set_config(..., true)`.
  - **Auth/bootstrap (server-controlled):** `src/lib/auth.ts` (credentials email lookup uses narrow server-controlled admin context before session issuance; session callback uses self-user context by `app.user_id`), `src/app/api/session/refresh/route.ts` (self context), `src/app/api/onboarding/company/route.ts` (authenticated user context for tenant bootstrap), `src/lib/email-actions.ts` (narrow system context for `EmailRequestLimit`/`EmailDelivery`/token/audit operations), `src/app/api/auth/{register,forgot-password,resend-verification,change-unverified-email}/route.ts` (server-controlled identity flows; generic responses preserved).
  - **Admin (server-authorized):** `src/app/api/plan/payment/proof/[id]/route.ts` keeps DB `platformRole` check and moves proof read into `runAsAdmin` transaction.
  - **Cron (cross-tenant intentional):** `src/app/api/cron/reminders/route.ts` requires `CRON_SECRET` and runs invoice scan/update in `runAsSystem`.
- **Tests executed (5437):** baseline `scripts/rls-staging-two-tenant-test.cjs` **19/19 PASS**; expanded `scripts/rls-priority-tables-test.cjs` **60/60 PASS**; new `scripts/rls-executor-integration-test.cjs` **5/5 PASS** (`tmp/rls-final-19.txt`, `tmp/rls-final-60.txt`, `tmp/rls-final-exec.txt`, `tmp/rls-executor-integration.txt`). New executor tests prove (NOBYPASSRLS): non-admin cannot read `EmailRequestLimit`, admin context can; self user lookup by id works with `app.user_id`; email lookup blocked without admin context under User RLS; missing tenant context sees zero invoices.
- **Static/quality:** `npx tsc --noEmit` **PASS** (after fixes). `vitest src/app/api/stock/route.test.ts` **4/4 PASS** (earlier in phase). Full build/suite/HTTP E2E **NOT EXECUTED**.

## Prisma/RLS Gap Matrix (summary)
| Class | Examples (this phase) | Status |
|---|---|---|
| TENANT_CONTEXT_OK | Tenant-scoped API routes/services using `getTenant*Access`/`runWithTenant` (company/customers/invoices/drafts/payments/status/stock routes sampled); invoice/payment/stock/report/saft/business-doc services with tenant tx patterns | **Partially proven** (DB isolation + code audit; HTTP E2E not executed) |
| MISSING_TENANT_CONTEXT | No remaining route in “prisma.* without tenant/admin/auth/cron guard” quick scan after targeted fixes | **No obvious route found by scan**; deeper service/lib coverage still requires full line audit |
| ADMIN_EXECUTOR_REQUIRED | `api/plan/payment/proof/[id]` | **Fixed (code)** to server auth + `runAsAdmin`; runtime E2E NOT EXECUTED |
| AUTH_EXECUTOR_REQUIRED | `api/session/refresh`, `api/onboarding/company`, auth register/forgot/resend/change-unverified-email, NextAuth credentials/session lookups, email token/rate-limit flows | **Partially fixed (code, minimal)**; PrismaAdapter still global; **HTTP/auth E2E NOT EXECUTED** |
| CRON_EXECUTOR_REQUIRED | `api/cron/reminders` | **Fixed (code)** CRON_SECRET + `runAsSystem`; runtime/cron E2E NOT EXECUTED |
| SAFE_GLOBAL_OPERATION | Public/share-token/health/static patterns with no sensitive tenant Prisma misuse | **Not fully enumerated** |

## Execution-Context Audit
- **Correct pattern present:** `runWithTenant`/`runWithRlsContext` use transaction-local `set_config(..., true)`. Tenant services/routes audited in prior phases remain the primary path.
- **Residual global Prisma risks:** `src/lib/prisma.ts` singleton remains; NextAuth `PrismaAdapter(prisma)` still uses global client (adapter tables RLS-off in 5437 prototype). `lib/admin-actions.ts`/admin data paths may still use global Prisma/tx patterns (not fully remediated in this phase). Public share/report endpoints not exhaustively retested under NOBYPASSRLS.
- **Pooling risk:** transaction-local GUC pattern is directionally compatible, but **Supabase/PgBouncer not validated**.

## What Is Proven
- DB-level tenant isolation and key RLS behavior on 5437 with NOBYPASSRLS (19/19 + 60/60).
- Executor integration semantics on 5437 (5/5): admin-only infra table blocked for non-admin; self-user context works; email lookup requires privileged/server-controlled path under current User policy; missing tenant context yields zero invoices.
- TypeScript compiles after fixes; stock route unit test passed.

## What Is NOT Proven / Blockers
- **HTTP E2E** against isolated Next.js app using 5437 + NOBYPASSRLS role: auth/login/register/OAuth/reset/verify, onboarding, session refresh, tenant A/B API isolation, admin authorization, draft/invoice/PDF/payment/stock/WMS flows. **NOT EXECUTED** (requires isolated runtime/env without disturbing existing processes/state).
- **NextAuth/PrismaAdapter full compatibility** under enforced RLS (adapter tables currently RLS-off prototype).
- **Admin actions runtime** (`admin-actions.ts` cross-tenant/platform operations) under NOBYPASSRLS.
- **Supabase/PgBouncer transaction pooling** compatibility.
- Prisma migration history anomaly in 5437 (`_prisma_migrations` absent while status reported up to date).
- 5437 schema drift vs current Prisma schema (full diff not applied; additive subset only).

## Artifacts
- `RLS_TABLE_COVERAGE_MATRIX.json/.md`, `RLS_PRIORITY_TABLES_EXECUTION_REPORT.json`
- `scripts/rls-staging-two-tenant-test.cjs`, `scripts/rls-priority-tables-test.cjs`, `scripts/rls-executor-integration-test.cjs`
- `tmp/rls-final-19.txt`, `tmp/rls-final-60.txt`, `tmp/rls-final-exec.txt`, `tmp/rls-executor-integration.txt`, `tmp/rls-api-matrix-v2.csv`

