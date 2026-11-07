# RLS_STALE_JWT_SENSITIVE_ROUTES_REPORT

**Date:** 2026-11-05  
**Branch:** `wms-v2-e2e-staging` (unchanged)  
**Worktree:** `C:\Users\Administrador\Desktop\facturacao-angola` — heavily modified preexisting state preserved; **no commits/push/merge/deploy** created.  
**Authorized scope only:** `127.0.0.1:5437/mf_rls_staging`, runtime user `mf_app_login` (`rolsuper=false`, `rolbypassrls=false`). No 5436/Supabase/production, no schema/migration/role/grant/policy/RLS changes, no `.env`/`.env.local` changes, no auth/revocation mechanism implementation, no destructive SQL.

## 1. Initial state (recorded, preserved)
- `git branch --show-current`: `wms-v2-e2e-staging`
- `git log -5 --oneline`: `95e0036`, `a23b2aa`, `4feef64`, `acf6fb6`, `5982f97`
- `git status --short`: large preexisting modified/untracked worktree (unchanged by this audit except new local artifacts/reports/scripts under `tmp/` and report files listed below).

## 2. Environment / methodology
- Isolated Next runtime: **3037** via `tmp/run-rls-next-3037-fg.cjs` (reads `tmp/.env.rls-e2e-5437`, refuses non-5437/non-`mf_app_login`, refuses `:5436`/supabase, sets `PORT/NEXTAUTH_URL/APP_URL` to 3037). Runtime responded `GET /api/auth/csrf` 200; stopped after audit; **no listeners on 3031–3037**.
- DB identity (audit artifact): `mf_rls_staging`, `mf_app_login`, `rs=false`, `rb=false`.
- Synthetic fixtures/users only (A, B, admin fixture; temporary synthetic customers/products created and cleaned). No real credentials.
- States per scenario where executed: **valid login -> signout -> updated jar checked** (`postSignoutJarHasUser:false`) **-> isolated pre-logout stale `authjs.session-token` reused** (same methodology as Phase A). Cookies not mixed; no JWT/cookie/token/secret values stored.
- Confirmation dimensions used: HTTP status, functional body class, tenant/resource effect, DB state before/after for mutation, no-leak/cross-tenant observation. **HTTP 200 alone is not treated as sufficient proof of vulnerability without interpretation; 401/403/404 alone not treated as proof of no side effect without DB/state context where relevant.**

## 3. Inventory basis
- Starting point: `tmp/rls-e2e-artifacts/authz-route-inventory.csv` (66 API routes).
- Static scan limitations remain: marker presence ≠ complete authorization; API routes only; server actions not exhaustively executed. `runAsSystem` routes/services reviewed by targeted reads (`cron/reminders` uses `CRON_SECRET` bearer + `runAsSystem` cross-tenant; auth bootstrap/public token flows as previously classified). No executor/policy changes.

## 4. Quantitative results
**Source:** `tmp/rls-e2e-artifacts/stale-jwt-sensitive-routes.json` / `stale-jwt-route-results.csv` (19 scenarios total).

| Metric | Value |
|---|---:|
| Total scenarios | 19 |
| Tested (HTTP+state/DB as applicable) | 14 |
| NOT EXECUTED | 5 |
| NOT PROVEN (risk bucket) | 5 |
| Critical | 0 |
| High | 1 |
| Medium | 7 |
| Low | 0 |
| No exposure observed | 0 |
| AT RISK | 6 |
| Cleanup | `staleTempCustomers:0`, `staleTempProducts:0` |

> Note: zero “no exposure observed” reflects the tested set — stale JWT was accepted on most tested protected reads/mutation, so rejection-by-stale-JWT was not observed as a defense in those cases (updated jar was rejected where checked). This is not a claim that all untested routes are exposed.

## 5. Results by domain / endpoint

| ID | Domain | Endpoint | Op | Stale HTTP | Updated jar | DB/mutation | Data/effect | Risk | Status |
|---|---|---|---|---:|---:|---|---|---|---|
| SJ-R-1 | produtos/clientes | `/api/produtos` GET | read | **200** | 401 | none | own tenant product data | **MÉDIO** | TESTED |
| SJ-R-2 | produtos/clientes | `/api/customers` GET | read | **200** | 401 | none | own tenant customer data | **MÉDIO** | TESTED |
| SJ-R-3 | produtos/clientes | `/api/customers/[id A]` GET | read | 405 | 405 | none | method not allowed; auth boundary not proven by GET | **AT RISK** | TESTED |
| SJ-R-4 | produtos/clientes | `/api/customers/[id B]` GET (cross-tenant target) | read | 405 | 405 | none | 405 masks read path; no leak observed, but GET not supported | **AT RISK** | TESTED |
| SJ-R-5 | relatórios | `/api/reports/export?format=csv&period=thisMonth&kind=sales` GET | read | **200** | 401 | none | own tenant report CSV bytes (company/report metadata/data rows) | **MÉDIO** | TESTED |
| SJ-R-6 | financeiro/fiscal | `/api/invoices/generate-saft?month=11&year=2026` GET | read | **200** | 401 | none | own tenant SAF-T XML bytes | **MÉDIO** | TESTED |
| SJ-R-7 | stock/WMS | `/api/stock/warehouses` GET | read | **200** | 401 | none | own tenant warehouses | **MÉDIO** | TESTED |
| SJ-R-8 | stock/WMS | `/api/stock/movements` GET | read | **200** | 401 | none | own tenant movements payload (empty in test) | **MÉDIO** | TESTED |
| SJ-R-9 | stock/WMS | `/api/stock/balances` GET | read | **200** | 401 | none | own tenant balances payload (empty in test) | **MÉDIO** | TESTED |
| SJ-R-10 | desktop | `/api/desktop/offline-bootstrap` GET | read | 405 | 405 | none | GET unsupported; POST sensitive (not executed) | **AT RISK** | TESTED |
| SJ-R-ADM | admin/planos | `/api/plan/payment/proof/[id]` GET (invalid id) | read | **404** body “Comprovativo não encontrado” | 401 | none | stale **admin** JWT passed auth+platform role check and reached DB lookup/id path; updated jar rejected 401 | **AT RISK** (admin auth boundary exposed) | TESTED |
| SJ-M-CUST | clientes | `/api/customers` POST | mutation | **200** | n/a (stale tested) | **created then cleaned** (tenant A) | stale JWT created own-tenant customer row; DB effect confirmed and reversed | **ALTO** | TESTED |
| SJ-M-CUST-X | clientes | `/api/customers/[id B]` PUT | mutation | 405 | n/a | B name unchanged | PUT unsupported on tested path; cross-tenant mutation not proven/executed via supported method | **AT RISK** | TESTED |
| SJ-M-STOCK-RET | stock/WMS | `/api/stock/returns` POST (fake IDs) | mutation | **404** “Produto não encontrado” | n/a | not verified with valid resources | stale JWT likely passed auth (returned domain 404, not 401); route uses `auth()+getSessionTenantId`, marker scan lacked `runWithTenant` — **real mutation risk not proven/disproven** | **AT RISK** | TESTED/AT RISK |
| SJ-NE-INV-PDF | facturação/PDF | `/api/invoices/generate-pdf` POST | mutation | — | — | — | fiscal/quota/PDF/DB side effects | **NOT PROVEN** | NOT EXECUTED |
| SJ-NE-INV-ISSUE | facturação | `/api/invoices/drafts/[id]/issue` POST | mutation | — | — | — | document finalization | **NOT PROVEN** | NOT EXECUTED |
| SJ-NE-CRON | cron | `/api/cron/reminders` GET | system | — | — | — | `CRON_SECRET` bearer, not session JWT; stale-JWT vector inapplicable by design | **NOT PROVEN** | NOT EXECUTED |
| SJ-NE-ONBOARD | onboarding | `/api/onboarding/company` POST | mutation | — | — | — | creates tenant/links user; hard to reverse safely | **NOT PROVEN** | NOT EXECUTED |
| SJ-NE-DESKTOP-POST | desktop | `/api/desktop/offline-bootstrap` POST | sensitive read/grant | — | — | — | may return sensitive snapshot/offline grant if authorized | **NOT PROVEN** | NOT EXECUTED |

## 6. Read/write/isolation findings
- **Reads (confirmed):** stale JWT accessed own-tenant `produtos`, `customers` list, `reports/export` CSV, `generate-saft` XML, stock `warehouses/movements/balances` with 200 while updated jar got 401.
- **Writes (confirmed):** stale JWT created an own-tenant customer (`POST /api/customers`, 200, DB row created under tenant A, then cleaned). **This is effective mutation, not only HTTP acceptance.**
- **Cross-tenant:** no cross-tenant data leak observed in executed cases. Cross-tenant GET customer-by-id and PUT were 405 (method/path not exercised by supported verb in this test); **not proof of isolation for supported mutating/reading variants**. Stale JWT did not mutate B in tested PUT case.
- **Admin:** stale admin JWT on `/api/plan/payment/proof/[id]` with invalid id returned **404** (resource lookup reached) while post-logout jar returned **401**. This indicates the admin-authenticated path accepted the stale JWT long enough to pass authorization and perform the route logic up to lookup. **High-sensitivity admin surface remains at risk** until revocation/route hardening is proven.
- **Stock returns:** returned 404 for fake IDs, not 401, while route uses `auth()+getSessionTenantId`; static inventory lacked `runWithTenant` marker. **Possible stale-JWT auth acceptance, mutation risk unproven.**
- **Financial/invoice mutations, PDFs, issue/cancel/payments, full admin CRUD, plan changes, desktop bootstrap POST, onboarding:** **NOT EXECUTED/NOT PROVEN** (irreversible/sensitive/external/fixture-safety constraints).

## 7. `runAsSystem` / privileged context audit (targeted, no code changes)
- **Token/bootstrap/auth flows:** `email-actions` verify/reset use narrow server-controlled system tx; previously audited for token lifecycle/concurrency on 5437. Public by design; stale-JWT not applicable.
- **`/api/cron/reminders`:** requires `CRON_SECRET` bearer (`401` without match), uses `runAsSystem` for cross-tenant invoice query/update and sends emails. Session-JWT stale-cookie vector not the primary auth mechanism; secret handling/cron abuse remains separate operational concern (not executed).
- **`/api/onboarding/company`:** uses `auth()` then `runWithRlsContext`/`runAsSystem` for tenant bootstrap/link. Not executed with stale JWT due to tenant-creation side effects.
- **`/api/plan/payment/proof/[id]`:** `auth()` + `runAsAdmin` role check/query. Stale admin JWT reached route logic (404 vs 401) — **privileged admin read path susceptible to stale-JWT acceptance under current model**.
- **General rule:** any path that enters `runAsSystem`/`runAsAdmin` after accepting `auth()`/JWT without server-side revocation is exposed to stale-JWT misuse within JWT validity window/state rules. No evidence of client-controlled tenant escalation was found in executed tests.

## 8. Risk classification (consolidated)
- **CRÍTICO:** 0 observed in this limited executed set. **Not proof of absence**; admin proof route behavior and unexecuted admin/financial/fiscal mutations remain high concern.
- **ALTO:** `POST /api/customers` mutation accepted with stale JWT and created DB row (reversible test).
- **MÉDIO:** stale-JWT reads of own-tenant business data — produtos, clientes, report export, SAF-T, warehouses/movements/balances.
- **BAIXO:** 0.
- **SEM EXPOSIÇÃO OBSERVADA:** 0 in executed set.
- **AT RISK/NOT PROVEN:** customer-by-id/PUT method-masked cases, desktop GET/POST, admin proof full retrieval, stock returns valid-resource mutation, all unexecuted fiscal/financial/admin/onboarding/ads/plan-mutating/sensitive-export flows, server actions, full 66-route matrix.

## 9. Evidence files
- `tmp/rls-e2e-artifacts/stale-jwt-sensitive-routes.json`
- `tmp/rls-e2e-artifacts/stale-jwt-route-results.csv`
- `tmp/rls-e2e-artifacts/authz-route-inventory.csv` (preexisting inventory basis)
- `tmp/stale-jwt-sensitive-routes-3037.cjs` (local test script)
- `tmp/run-rls-next-3037-fg.cjs`, `tmp/run-rls-next-3037-fg.cjs` launcher used; `tmp/next-3037*.log` may exist if created during attempts
- Prior context: `tmp/rls-e2e-artifacts/jwt-revocation-phase-a-repro.json`, `jwt-revocation-security.json`

No JWTs/cookies/passwords/tokens/secrets stored.

## 10. Recommendations for centralized JWT revocation (design input; NOT implemented)
1. **Preferred structural fix:** DB-backed per-token/session revocation (JTI denylist or revocation/session table) checked fail-closed on protected auth/session/refresh and sensitive routes; revoke on logout, password/session reset, suspension, admin security events.
2. Add `jti` (and auditable session metadata) to JWT issuance; store revocation keyed by `jti`/hash with expiry and bounded cleanup.
3. Keep `sessionVersion` checks as defense-in-depth; they do not replace logout-time revocation for unchanged state.
4. Centralize protected-route session validation (`requireValidRevokedSafeSession`/equivalent) to reduce per-route drift; prioritize admin, financial, fiscal/PDF/export, mutations, desktop bootstrap, and `runAsSystem/runAsAdmin` entry paths.
5. Audit server actions and non-API handlers (this pass focused on API routes).
6. Re-run full stale-JWT matrix on 5437 after any approved implementation (Phase D race + reads/writes/admin/financial/WMS/PDF/cross-tenant/state changes), then only consider production planning with migration/role/pooling evidence.

## 11. Cleanup / final checks
- Temp fixtures created by this run: removed/cleaned (`staleTempCustomers:0`, `staleTempProducts:0`). Baseline synthetic users A/B/admin preserved.
- Next test runtime 3037 stopped; **ports 3031–3037 have no listeners**.
- `.env`/`.env.local`: not modified.
- 5436/Supabase/production: not used. No schema/migration/RLS/role/grant/policy changes. No commits/push/merge/deploy.
- Preexisting worktree changes preserved.
