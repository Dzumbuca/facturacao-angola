# RLS_HTTP_E2E_REPORT

**Status:** **PARTIAL — DB runtime identity proven; HTTP A/B isolation proven for selected resources; full E2E NOT COMPLETE.**

## DB/runtime identity (5437 only, NOBYPASSRLS)
- **Temp Next runtime proof (PASS, then route removed):** `tmp/rls-e2e-artifacts/runtime-db-identity.json` (port 3024, 5437-targeted env). Anonymous `GET /api/rls-runtime-proof` = **401**. Authenticated A session = **200** with `db=mf_rls_staging`, `usr=mf_app_login`, `rolsuper=false`, `rolbypassrls=false`, `tenant_rls=true`, `tenant_rls_forced=false`, `app_user_id_matches_session=true`, `app_tenant_id_present=true`, `app_is_admin=false`, `staging_runtime_guard=true`. Temp route `src/app/api/rls-runtime-proof/route.ts` **deleted** after capture; removal verified on fresh runtime (3025 probe recorded in evidence flow; route absent in tree).
- **Prior Prisma process proof:** `mf_rls_staging, mf_app_login, rolsuper=false, rolbypassrls=false, host_target_port_5437=true`.
- **Isolation strategy:** Node launchers read `tmp/.env.rls-e2e-5437` (local, not committed) and inject env before spawning `next dev --webpack -p <port> -H 127.0.0.1`, refusing unless DB URL contains `:5437/` and `mf_app_login`. Next still reports `.env.local,.env` loaded (precedence risk remains). No `.env`/`.env.local` modified.

## Executed HTTP evidence (synthetic fixtures only)
| Suite | Result | Evidence |
|---|---|---|
| Runtime DB identity via temp Next route | **PASS** (captured, removed) | `runtime-db-identity.json` |
| Auth A/B credentials + session independence | **PASS** | `http-isolation-ab-extended.json`, `http-auth-admin-probe.json` |
| Logout A invalidates session cookie context | **PASS** | `http-auth-admin-probe.json` (`signout` 302, after session has no user) |
| Unauth `GET /api/produtos` | **PASS** (401/403, no data) | `http-isolation-ab-extended.json` |
| Unauth `GET /api/plan/payment` | **PASS** (401) | `http-auth-admin-probe.json` |
| `GET /api/produtos` A/B isolation | **PASS** (200 own only; no other tenant IDs) | `http-isolation-ab-extended.json` |
| `GET /api/stock/warehouses` A/B isolation | **PASS** | same |
| `GET /api/customers` A/B isolation | **PASS** | same |
| Cross-tenant `GET/PATCH /api/stock/warehouses/{other}` A/B | **PASS** (401/403/404/405, no leak) | same |
| Cross-tenant `GET/PATCH /api/produtos/{other}` A/B | **PASS** (404/405 observed, no leak) | same |
| Cross-tenant `GET/PATCH /api/customers/{other}` A/B | **PASS** (404, no leak) | same |
| Admin fixture login (`rls-e2e-admin@example.test`) | **PASS** | `http-auth-admin-probe.json` |
| DB RLS regressions | **PASS** 19/19, 60/60, 5/5 | `scripts/rls-staging-two-tenant-test.cjs`, `scripts/rls-priority-tables-test.cjs`, `scripts/rls-executor-integration-test.cjs` |
| TypeScript | **PASS** | `tsc --noEmit` |

## Not Executed / Not Proven
| Area | Status | Notes |
|---|---|---|
| Register/verify/resend/change-unverified-email/forgot/reset full HTTP | **NOT EXECUTED** | Auth routes have RLS context changes; end-to-end flows not run. |
| OAuth/PrismaAdapter HTTP (Google linking/callback/account/session persistence) | **NOT EXECUTED / AT RISK** | External creds unavailable; adapter uses global Prisma; Account/Session/VerificationToken/EmailActionToken RLS OFF on 5437 prototype. |
| Session refresh/onboarding HTTP | **NOT EXECUTED** | Code has explicit RLS context; no HTTP proof. |
| Expired session / invalid session / post-logout access matrix | **PARTIAL** | Logout PASS; expired/invalid token cases NOT EXECUTED. |
| Full admin HTTP (normal/company admin/platform ADMIN/SUPERADMIN role matrix, proof actions, plan management, user management, tenant manipulation) | **NOT EXECUTED** | Only admin fixture login + anon plan payment 401 probed. |
| Financial cycle HTTP (customer/product CRUD beyond reads, draft->issue->PDF->payment partial/total->history/balances/receivables/reports/cancel/reversal, cross-tenant invoice/payment/doc access, PDF protection) | **NOT EXECUTED** | Payment service uses `runWithTenant`; schema/fixtures/endpoints require careful setup. |
| WMS full HTTP flows (entries/exits/adjustments/transfers/PO/reception/movements/reversals/idempotency/history/reports/composite FKs) | **NOT EXECUTED** | Preexisting WMS work preserved; do not modify without demonstrated failure. |
| Manipulated `tenantId` payload exhaustive checks | **PARTIAL** | Cross-tenant path ID checks PASS on tested resources; payload/body manipulation matrix NOT EXECUTED. |
| Playwright suite | **NOT EXECUTED** | Node HTTP probes used. |

## Conclusion
**PASS for proven subset:** runtime DB identity on 5437/NOBYPASSRLS + authenticated A/B isolation for products/warehouses/customers + cross-tenant ID access blocked with no leak + basic auth/session/logout/unauth guards. **NOT sufficient for production readiness.**
