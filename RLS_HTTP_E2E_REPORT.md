# RLS_HTTP_E2E_REPORT

**Status:** **NOT EXECUTED (BLOCKED by isolated runtime requirement).**

## Reason
HTTP E2E under RLS enforcement requires an isolated Next.js app instance pointed at `mf_rls_staging` (`127.0.0.1:5437`) using a **NOBYPASSRLS** role/connection strategy, with independent runtime env/config, without disturbing existing developer processes/worktree state. Playwright config targets `http://localhost:3000` (`playwright.config.ts`, `testDir ./e2e`; `@playwright/test` present).

This phase did **not** start or mutate a shared app runtime. No production/Supabase/5436 access used.

## Existing E2E assets observed
- `e2e/` contains visual smoke specs (e.g. `wms-visual-smoke.spec.ts`, invoices/products/customers/stock/warehouses smoke specs) — **not executed** against RLS-enforced 5437 in this phase.

## Blockers
| Scenario | Blocker |
|---|---|
| Auth (login/register/verify/reset/OAuth/session) | Requires isolated app + NOBYPASSRLS DB role + auth env/cookies; PrismaAdapter still global; HTTP path unproven |
| Tenant A/B API isolation over HTTP | Requires authenticated fixtures/users/tenants in 5437 and isolated app runtime |
| Admin authorization HTTP | Requires admin fixtures and runtime; `admin-actions` not fully migrated |
| Draft/invoice/PDF/payment/receipt/stock/WMS HTTP flows | Requires seeded tenant data and 5437 schema compatibility for full Prisma models; runtime not started |
| Cron HTTP trigger simulation | Requires CRON_SECRET/configured endpoint runtime; code fixed but not exercised via HTTP |

## Evidence used instead (real)
- DB/SQL isolation: **19/19 PASS** (baseline), **60/60 PASS** (expanded priority), **5/5 PASS** (executor integration) on PG17+RLS+NOBYPASSRLS.
- Code fixes: RLS executor helpers + targeted auth/admin/cron/session/onboarding routes. `tsc --noEmit` PASS.

## Required execution plan (when safe)
1. Start temp Next.js (`PORT` != 3000) with `DATABASE_URL/DIRECT_URL` -> 5437 NOBYPASSRLS role and isolated secrets.
2. Seed synthetic tenants/users/admin/products/customers in 5437 only.
3. Run Playwright against temp base URL; capture traces/screenshots/logs.
4. Classify failures: missing context, RLS policy, auth/adapter, admin executor, schema drift, app bug.

## Conclusion
**NOT EXECUTED.** Cannot claim HTTP-level tenant/auth/admin isolation.
