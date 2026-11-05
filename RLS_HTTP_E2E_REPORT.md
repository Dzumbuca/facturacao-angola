# RLS_HTTP_E2E_REPORT

**Status:** **NOT EXECUTED (PARTIAL PREP / BLOCKED by safe isolated runtime).**

## Environment Prep (5437 only, NOBYPASSRLS)
- Confirmed `mf_app_login` is `NOSUPERUSER NOBYPASSRLS LOGIN` on `127.0.0.1:5437/mf_rls_staging`. Port 5436 not used.
- Created isolated temp env file `tmp/.env.rls-e2e-5437` (**not committed**, gitignored; contains local test credentials) pointing to 5437 with `mf_app_login`, `NEXTAUTH_URL/APP_URL=http://127.0.0.1:3017`, ephemeral `NEXTAUTH_SECRET`, `CRON_SECRET`. Safe example committed: `e2e/rls-http-e2e.env.example`.
- Additive 5437-only schema compatibility applied for Prisma/current app drift (Product/StockMovement fields/types/indexes where safe) via `tmp/rls-5437-schema-compat.cjs` — **staging 5437 only, additive, documented**.
- Seeded synthetic fixtures on 5437 (postgres, idempotent, 5437-only): tenants `RLS E2E Tenant A/B` (`aaaaaaaa-...0001`, `bbbbbbbb-...0002`), users `rls-e2e-a/b/admin@example.test` (A/B COMPANY_ADMIN/NONE, admin SUPERADMIN), passwords hashed in DB. Script: `tmp/seed-rls-e2e-tenants.cjs` (no secrets committed).
- NOBYPASSRLS probes via `mf_app_login`/`tmp/rls-app-login-probe.cjs`: **3/3 PASS** (missing tenant context sees 0 invoices; A context cannot read B customers/products by explicit tenant filter; self user lookup by `app.user_id` works).

## HTTP Runtime Attempt
- Initial isolated `next dev --webpack -p 3017` (PID 34624, `C:\...\facturacao-angola`, port 3017 only) compiled but became unresponsive/hung after starting `/api/auth/[...nextauth]/route` compile; HTTP probes timed out. Process **stopped** (only this PID). `.env`/`.env.local` exist in worktree and may be loaded by Next; env precedence/isolation needs a verified launch method (dotenv override or dedicated env strategy) before trusting HTTP results.
- Restart attempt via detached Node launcher failed in this shell with `spawn EINVAL` (no listener left on 3017).

## Playwright Assets
- `e2e/rls-http-isolation.spec.ts` created (auth page/login attempts A/B, tenant-scoped customers API check, guessed invoice id access check, cron missing-secret 401/403 guard). **NOT EXECUTED** successfully against a stable RLS-enforced runtime.
- Temp config: `tmp/playwright.rls.config.ts` (baseURL `127.0.0.1:3017`, artifacts in `tmp/rls-e2e-artifacts`).

## Not Executed / Blocked Scenarios
| Scenario | Result | Blocker |
|---|---|---|
| Auth HTTP (login/logout/register/verify/reset/OAuth/refresh/session cookie) | **NOT EXECUTED** | Stable isolated app runtime not running with verified 5437+NOBYPASSRLS env precedence; PrismaAdapter global/prototype adapter tables RLS-off |
| Tenant A/B HTTP isolation (full CRUD/API matrix) | **NOT EXECUTED** | Runtime blocker; DB probes pass but HTTP proof missing |
| Admin HTTP (normal/admin/SUPERADMIN, proof/actions) | **NOT EXECUTED** | Runtime blocker; admin-actions runtime not fully migrated/validated |
| Financial HTTP (draft->issue->PDF->payment->balance/history) | **NOT EXECUTED** | Runtime blocker + 5437 schema drift for full model behavior |
| WMS HTTP (warehouses/lots/adjustments/reservations/transfers/PO/receptions/movements) | **NOT EXECUTED** | Runtime blocker |
| NextAuth adapter compatibility | **NOT EXECUTED** | Runtime blocker |
| Cron authorized path | **NOT EXECUTED** | Runtime blocker; missing-secret guard present in spec but not run end-to-end |

## Evidence Available
- DB/SQL: **19/19 PASS**, **60/60 PASS**, **5/5 executor PASS** rerun after phase (`tmp/rls-final-http-phase-*`).
- NOBYPASSRLS app-role DB probes: **3/3 PASS**.
- `tsc --noEmit` PASS.

## Next Safe Steps
1. Launch isolated Next with **verified env precedence** (ensure 5437 NOBYPASSRLS `DATABASE_URL` is effective despite `.env`/`.env.local`; do not overwrite existing env files).
2. Run Playwright against temp port with synthetic A/B/admin fixtures; capture traces.
3. Expand spec to real create/read/update/delete across tenants, admin actions, invoice/payment/WMS flows as data/schema permits; classify failures precisely.

## Conclusion
**NOT EXECUTED for HTTP runtime.** Preparation improved (fixtures, NOBYPASSRLS probes, spec/config, additive 5437 compat), but **no HTTP-level pass can be claimed**.

