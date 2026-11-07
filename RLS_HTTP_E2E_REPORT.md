# RLS_HTTP_E2E_REPORT

**Status:** **PARTIAL — DB runtime identity proven; HTTP A/B isolation proven for selected resources; selected auth/email/onboarding controlled flows now PASS on 5437; full E2E NOT COMPLETE.**

## DB/runtime identity (5437 only, NOBYPASSRLS)
- **Temp Next runtime proof (PASS, then route removed):** `tmp/rls-e2e-artifacts/runtime-db-identity.json` (port 3024, 5437-targeted env). Anonymous `GET /api/rls-runtime-proof` = **401**. Authenticated A session = **200** with `db=mf_rls_staging`, `usr=mf_app_login`, `rolsuper=false`, `rolbypassrls=false`, `tenant_rls=true`, `tenant_rls_forced=false`, `app_user_id_matches_session=true`, `app_tenant_id_present=true`, `app_is_admin=false`, `staging_runtime_guard=true`. Temp route `src/app/api/rls-runtime-proof/route.ts` **deleted** after capture; removal verified on fresh runtime (3025 probe recorded in evidence flow; route absent in tree).
- **Prior Prisma process proof:** `mf_rls_staging, mf_app_login, rolsuper=false, rolbypassrls=false, host_target_port_5437=true`.
- **Isolation strategy:** Node launchers read `tmp/.env.rls-e2e-5437` (local, not committed) and inject env before spawning `next dev --webpack -p <port> -H 127.0.0.1`, refusing unless DB URL contains `:5437/` and `mf_app_login`. Next still reports `.env.local,.env` loaded (precedence risk remains). No `.env`/`.env.local` modified.
- **Focused 2026-11-05 run:** port 3033, launcher-enforced 5437 env; artifact `tmp/rls-e2e-artifacts/auth-flows-final.json` references prior 5437 identity proofs but does not restate per-request DB identity for each case.

## Executed HTTP evidence (synthetic fixtures only)
| Suite | Result | Evidence |
|---|---|---|
| Runtime DB identity via temp Next route | **PASS** (captured, removed) | `runtime-db-identity.json` |
| Auth A/B credentials + session independence | **PASS** | `http-isolation-ab-extended.json`, `http-auth-admin-probe.json`, `auth-flows-final.json` |
| Invalid credentials | **PASS** (no session user) | `auth-flows-final.json` |
| No-tenant synthetic fixture login | **PASS** (tenantId null) | `auth-flows-final.json` (fixture restored after prior onboarding mutation) |
| Logout A invalidates session cookie context | **PASS** | `http-auth-admin-probe.json` (`signout` 302, after session has no user) |
| Unauth `GET /api/produtos` | **PASS** (401/403, no data) | `http-isolation-ab-extended.json` |
| Unauth `GET /api/plan/payment` | **PASS** (401) | `http-auth-admin-probe.json` |
| `GET /api/produtos` A/B isolation | **PASS** (200 own only; no other tenant IDs) | `http-isolation-ab-extended.json` |
| `GET /api/stock/warehouses` A/B isolation | **PASS** | same + light regression in `auth-flows-final.json` |
| `GET /api/customers` A/B isolation | **PASS** | `http-isolation-ab-extended.json` |
| Cross-tenant `GET/PATCH /api/stock/warehouses/{other}` A/B | **PASS** (401/403/404/405, no leak) | same |
| Cross-tenant `GET/PATCH /api/produtos/{other}` A/B | **PASS** (404/405 observed, no leak) | same |
| Cross-tenant `GET/PATCH /api/customers/{other}` A/B | **PASS** (404, no leak) | same |
| `POST /api/auth/verify-email` nonexistent token | **PASS** (controlled 400) | `auth-flows-final.json` |
| `POST /api/auth/verify-email` invalid/short token | **PASS** (controlled 400) | `auth-flows-final.json` |
| `POST /api/auth/reset-password` nonexistent token | **PASS** (controlled 400) | `auth-flows-final.json` |
| `POST /api/auth/reset-password` invalid/short token | **PASS** (controlled 400) | `auth-flows-final.json` |
| `POST /api/auth/reset-password` short password | **PASS** (controlled 400) | `auth-flows-final.json` |
| `POST /api/auth/resend-verification` generic | **PASS** (200) | `auth-flows-final.json` |
| `POST /api/auth/forgot-password` generic | **PASS** (200) | `auth-flows-final.json` |
| `POST /api/onboarding/company` unauth | **PASS** (401) | `auth-flows-final.json` |
| `POST /api/onboarding/company` valid no-tenant + repeated | **PASS** (200, idempotent) | `auth-flows-final.json` |
| `POST /api/session/refresh` after onboarding | **PASS** (200) | `auth-flows-final.json` |
| Admin fixture login (`rls-e2e-admin@example.test`) | **PASS** | `http-auth-admin-probe.json` |
| DB RLS regressions | **PASS** 19/19, 60/60, 5/5 | `scripts/rls-staging-two-tenant-test.cjs`, `scripts/rls-priority-tables-test.cjs`, `scripts/rls-executor-integration-test.cjs` (re-run 2026-11-05 on 5437) |
| TypeScript | **PASS** | `tsc --noEmit` (2026-11-05) |

## 2026-11-05 token lifecycle + concurrency (5437, HTTP 3034)
- **Evidence:** `tmp/rls-e2e-artifacts/token-lifecycle-concurrency.json`, `RLS_TOKEN_LIFECYCLE_REPORT.md`.
- **PASS (18/19 cases):** verify/reset nonexistent, invalid format, expired (not consumed), consumed, wrong purpose (not consumed), valid consume with DB state check (temp synthetic users), reuse after consume, cross-user boundary (token owner only; A unchanged), **concurrency same token** — verify `[200,400]`, reset `[400,200]`, exactly one functional consume and one sessionVersion/password mutation.
- **NOT APPLICABLE (1):** revoked state not modeled in schema (`consumedAt`/`expiresAt`).
- **Cleanup:** 12 temp token rows, 4 temp users, related audit/delivery rows removed; `rls-e2e-notenant` restored; B password restored after boundary test (sessionVersion may differ). No temp tokens/users remain; no test Next listeners.
- **AT RISK / NOT EXECUTED:** change-unverified-email token lifecycle; adapter `VerificationToken` lifecycle; mailbox-intercepted issuance→consume; full session invalidation matrix; OAuth/PrismaAdapter; pooling; production.

## Not Executed / Not Proven
| Area | Status | Notes |
|---|---|---|
| Verify/reset expired token HTTP | **NOT EXECUTED** | No safe synthetic `EmailActionToken` fixture (DB had no EmailActionToken rows on inspection). |
| Verify/reset consumed token HTTP | **NOT EXECUTED** | No safe synthetic fixture. |
| Verify/reset token belonging to other user HTTP | **NOT EXECUTED** | No safe synthetic cross-user fixture. |
| Verify/reset valid-token success path HTTP | **NOT EXECUTED** | Would consume token/mutate password/session; no safe fixture prepared. |
| Register/verify lifecycle issuance→consume end-to-end HTTP | **NOT EXECUTED** | Requires safe fixture or controlled issuance without secrets exposure. |
| OAuth/PrismaAdapter HTTP (Google linking/callback/account/session persistence) | **NOT EXECUTED / AT RISK** | External creds unavailable; adapter uses global Prisma; adapter tables RLS OFF on 5437 prototype. |
| Session refresh/onboarding exhaustive HTTP matrix | **PARTIAL** | Selected cases PASS. |
| Expired session / invalid session / post-logout access full matrix | **PARTIAL** | Logout PASS; expired/invalid token cases NOT EXECUTED. |
| Full admin HTTP (normal/company admin/platform ADMIN/SUPERADMIN role matrix, proof actions, plan management, user management, tenant manipulation) | **NOT EXECUTED** | Only admin fixture login + anon plan payment 401 probed previously. |
| Financial cycle HTTP (customer/product CRUD beyond reads, draft->issue->PDF->payment partial/total->history/balances/receivables/reports/cancel/reversal, cross-tenant invoice/payment/doc access, PDF protection) | **NOT EXECUTED** | Payment service uses `runWithTenant`; schema/fixtures/endpoints require careful setup. |
| WMS full HTTP flows (entries/exits/adjustments/transfers/PO/reception/movements/reversals/idempotency/history/reports/composite FKs) | **NOT EXECUTED** | Preexisting WMS work preserved; do not modify without demonstrated failure. |
| Manipulated `tenantId` payload exhaustive checks | **PARTIAL** | Cross-tenant path ID checks PASS on tested resources; payload/body manipulation matrix NOT EXECUTED. |
| Playwright suite | **NOT EXECUTED** | Node HTTP probes used. |
| Concurrent requests full matrix | **NOT EXECUTED** | Light multi-step flows only. |

## Conclusion
**PASS for proven subset:** runtime DB identity on 5437/NOBYPASSRLS (prior proof) + authenticated A/B isolation for products/warehouses/customers + cross-tenant ID access blocked with no leak + basic auth/session/logout/unauth guards + **controlled 400 handling for verify/reset invalid/nonexistent tokens and selected onboarding/reset-generic flows**. **NOT sufficient for production readiness.**
