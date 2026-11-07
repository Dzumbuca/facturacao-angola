# RLS_JWT_REVOCATION_AUDIT_REPORT

**Date:** 2026-11-05 (evidence captured 22:34–22:37 UTC from 5437 runtime artifacts)  
**Branch/worktree:** `wms-v2-e2e-staging`, `C:\Users\Administrador\Desktop\facturacao-angola` (heavily modified; this report documents only; no production/auth mechanism/RLS/policy/schema/migration/role changes made).  
**Authorized runtime/DB:** isolated Next runtimes pointed at `127.0.0.1:5437/mf_rls_staging` only (ports observed in artifacts: `3036`; ports 3031–3036 clear after stops per context). DB identity recorded in artifacts: `db=mf_rls_staging`, `usr=mf_app_login`, `rs=false` (NOBYPASSRLS session role context), `rb=false`. **No 5436/Supabase/production, no reset/disable RLS/BYPASSRLS, no `.env`/`.env.local` changes, no push/merge/deploy.**  
**Evidence artifacts (local, not committed):** `tmp/rls-e2e-artifacts/jwt-revocation-security.json`, `jwt-revocation-phase-a-repro.json`, `jwt-revocation-phase-e-state.json`, `authz-route-inventory.csv`, `token-lifecycle-concurrency.json` + `RLS_TOKEN_LIFECYCLE_REPORT.md`, DB regression reports/scripts rerun on 5437 (19/19, 60/60, 5/5). `tsc --noEmit` PASS.

## Executive state
**NOT production-ready for session revocation.** Phase A reproduces the reported problem: after signout the client-side updated jar is invalidated, but a pre-logout JWT cookie copy remains accepted by `/api/auth/session`, `/api/produtos`, and `/api/session/refresh` while `sessionVersion` is unchanged and user remains ACTIVE/verified. Phase E shows DB-backed session callback correctly rejects `SUSPENDED` users and reflects DB `tenantId`/fresh-login context, but `sessionVersion`-independent role/permission trust in routes that read only JWT claims would remain risky (observed role change with unchanged `sessionVersion` kept a valid session; route permission behavior depends on per-route implementation and was not exhaustively proven). No structural server-side JWT revocation was implemented; Phase B is design-only. Phases D/F/G are NOT EXECUTED/NOT PROVEN.

## Summary counts (from `jwt-revocation-security.json`)
`pass:14 fail:3 atRisk:3 notExecuted:2 notProven:2 notApplicable:0 observed:3` (includes Phase A/E + B/C/D/F/G status entries).

---

## Phase A — Logout invalidation reproduction (FAIL for stale-cookie reuse; PASS for normal client flow)
**Script/artifact:** `tmp/jwt-revocation-phase-a-3036.cjs` → `jwt-revocation-phase-a-repro.json` (2026-11-05T22:34:08Z, port 3036, 5437). Isolated pre-logout `authjs.session-token` jar copy reused after signout. No code changes.

| ID | Status | Observation |
|---|---|---|
| A1-LOGIN | PASS | Credentials login A returned session cookie; session has `tenantId`. |
| A2-OLD-JAR-ISOLATED | PASS | Pre-logout cookie copy isolated (not mixed with signout response). |
| A3-PRE-LOGOUT-SESSION | PASS | Pre-logout session valid. |
| A4-PRE-LOGOUT-PRODUTOS | PASS | Protected route `GET /api/produtos` returned 200. |
| A5-SIGNOUT-RESPONSE | PASS | Signout returned 302; artifact notes `clearCookies:0`, `sessionCookiesInResponse:[]` (response capture detail; client jar update still removed access in A6). |
| A6-POST-LOGOUT-UPDATED-JAR | PASS | Updated jar: session has no user; `/api/produtos` 401. Normal UX logout works for that browser jar. |
| A7-OLD-COOKIE-SESSION | **FAIL** | Reused pre-logout cookie: `GET /api/auth/session` returned 200 with user A (`id=…0a1`, `tenantId` A, `expires=2026-12-05T22:34:07Z`). |
| A8-OLD-COOKIE-PRODUTOS | **FAIL** | Reused pre-logout cookie: `GET /api/produtos` returned 200 with tenant-A product body. **Authoritative protected-route behavior.** |
| A9-OLD-COOKIE-REFRESH | **FAIL** | Reused pre-logout cookie: `POST /api/session/refresh` returned 200 `{success:true,tenantId:A}` and can re-issue/refresh session material per implementation (route encodes refreshed JWT when token/user valid). |

**Conclusion:** signout clears/invalidates the cooperating client jar but does **not** server-revoke the JWT. Any copied/leaked pre-logout cookie remains usable until expiry or until a state change causes the JWT callback/session validation to reject it (e.g. `sessionVersion` mismatch, SUSPENDED, verification requirements, depending on implementation). This matches expected Auth.js v5 JWT stateless behavior absent denylist/DB-session revocation.

---

## Phase B — Structural revocation design (NOT EXECUTED; design only)
**No code/schema/migration/policy/role change implemented.** Strategies compared:

| Strategy | Pros | Cons / risks | Fit |
|---|---|---|---|
| **A. DB-backed denylist / revoked JTI/session table** | True server-side revocation for copied JWTs; can revoke on logout/password reset/suspend/critical events; preserves JWT read performance if checked narrowly (e.g. `jti`/hash lookup, short-lived cache with invalidation discipline). | Requires schema/migration + write paths on issuance/logout/revoke + lookup on critical auth callbacks/routes; must avoid leaking cross-tenant data (global/session table RLS/executor design needed); cache invalidation/distributed consistency; storage/cleanup; PgBouncer transaction-pooling + per-request context caveats. | **Best structural option** for “old cookie cannot access after logout/suspension/revocation event”, if authorized and carefully implemented. |
| **B. Database sessions (`strategy:'database'`)** | Server session state natural; easier revocation/delete semantics; session callback logic changes. | Large Auth.js adapter behavior change; adapter tables currently RLS OFF prototype on 5437; `PrismaAdapter(prisma)` global client and pooling/RLS compatibility NOT PROVEN; may affect all auth flows/OAuth. | High risk/compatibility work; not a small fix. |
| **C. Global sessionVersion bump on every logout** | Simple conceptually; reuses existing version check. | **Not per-device/session**: logging out one client revokes all user sessions/devices; bad UX/security tradeoff; does not distinguish stolen old cookie from legitimate other sessions unless per-session model exists. | Only as emergency/coarse measure; not recommended as default logout fix. |
| **D. Rotate signing secret / broad invalidation** | Nuclear invalidation. | Revokes all sessions for all users/app scope depending secret use; operationally severe. | Not appropriate. |
| **E. Shorter JWT expiry + refresh discipline** | Reduces exposure window. | Does not revoke copied cookie within window; refresh endpoint currently reissues when token/user valid (A9). | Mitigation only, not revocation. |

**Recommendation (design):** prefer **A (revoked JTI/denylist or per-session revocation record)** with: unique `jti` issued into JWT, revocation row created on logout/reset/suspend/security events, JWT/session callback and/or sensitive route guard checks revocation state with fail-closed behavior on lookup errors for protected operations, bounded TTL/index/cleanup, server-controlled RLS context for revocation table (avoid tenant-id leakage semantics; table likely user/session scoped, not tenant business data), and explicit rollout + regression matrix. Do **not** claim this is implemented. Do **not** implement without authorization.

---

## Phase C — Authorization inventory/classification (PASS for inventory; risks observed)
**Artifact:** `tmp/rls-e2e-artifacts/authz-route-inventory.csv` (66 API route files scanned). Static marker scan only — **not proof of complete authorization correctness**.

**No obvious auth marker scanned (6):**
| Route | Classification | Notes |
|---|---|---|
| `src/app/api/auth/[...nextauth]/route.ts` | **Expected/public framework handler** | NextAuth handler; auth managed by framework config/callbacks. |
| `src/app/api/auth/reset-password/route.ts` | **Public token bootstrap, thin wrapper** | Delegates to `resetPasswordWithToken`; token hash/purpose/expiry/consumption validated server-side (see token lifecycle report). Not user-session guarded by design. |
| `src/app/api/auth/verify-email/route.ts` | **Public token bootstrap, thin wrapper** | Delegates to `verifyEmailToken`. |
| `src/app/api/email/unsubscribe/route.ts` | **Public token link/action** | Uses unsubscribe token flow in `email-actions`; not session-auth route. |
| `src/app/api/team-invites/accept/route.ts` | **Public invite-token flow** | Accepts invite token payload; `acceptTeamInvite` performs server-side token/hash/status/expiry checks and account mutation. |
| `src/app/api/team-invites/preview/route.ts` | **Public invite-token preview** | Returns limited preview by token; server-side token checks apply. |

**`runAsSystem` without tenant/session markers (5):** `auth/change-unverified-email`, `auth/forgot-password`, `auth/register`, `auth/resend-verification`, `cron/reminders`. These are **server-controlled bootstrap/system flows** or cron; acceptable only with strict server-side validation/rate limiting/secrets, not tenant user data routes. Cron/reminders must be independently audited for trigger auth/secret (not executed here). No change made.

**`await auth()` present but no `getTenantReadAccess/getTenantWriteAccess/requireAdmin` markers (17 routes, per scan):** includes `onboarding/company`, `plan/payment*`, and many `stock/*` routes that also use `getSessionTenantId`/`runWithTenant` markers in combinations. **AT RISK for blanket assumptions**: marker scan cannot prove they reject stale JWTs, enforce tenant/resource ownership, or avoid trusting JWT-only claims. `plan/payment/proof/[id]` uses `runAsAdmin` + `auth()` — requires targeted proof that admin/ownership checks are correct. `stock/returns` has `getSessionTenantId` + `auth()` but no `runWithTenant` marker — **review priority** (static signal only).

**JWT-only trust / stale-cookie exposure:** any route that accepts the JWT via `auth()`/NextAuth session and performs authorization using JWT claims without DB-backed version/status/resource checks is exposed to Phase A stale-cookie reuse until structural revocation exists. `src/lib/auth.ts` session callback revalidates `sessionVersion/status/verification` from DB and computes `session.user.id=''`/tenant null when invalid; **but** route behavior varies — some routes call `auth()`, some use `getServerSession`/custom helpers, some use `runWithTenant` with tenant from session. A centralized `requireValidSessionForProtectedRoute` pattern was **not implemented**.

---

## Phase E — State-change invalidation checks (PARTIAL; suspension PASS, tenant/role observed)
**Artifact:** `jwt-revocation-phase-e-state.json` (2026-11-05T22:35:11Z, 3036, 5437). Temporary user created and cleaned up.

| Check | Status | Observation |
|---|---|---|
| E-SUSPENDED-SESSION/PRODUTOS/REFRESH | **PASS** | After DB status became `SUSPENDED`, existing old JWT: session had no valid user, `/api/produtos` 401, `/api/session/refresh` 401. Session callback/refresh security rejected suspended state. |
| E-TENANT-CHANGE fresh login | **PASS** | Fresh login saw DB tenant B. |
| E-TENANT-CHANGE old JWT session/produtos | **OBSERVED** | Old JWT remained valid (sessionVersion unchanged). Session callback returned DB-priority `tenantId` B; `/api/produtos` returned 200. Behavior is DB-authoritative for tenant in session callback, but old cookie still functionally valid — **not revocation**; demonstrates unchanged-version JWT can continue until expiry. Route tenant isolation depends on how routes derive tenant; RLS/tenant context correctness was not exhaustively proven for every route in this observed case. |
| E-ROLE-CHANGE old JWT | **OBSERVED** | `sessionVersion` unchanged; session remained valid with tenant context from DB per callback. Role/permissions were **not** exhaustively tested at route level; if any route trusts JWT role claims or caches permissions without DB check, privilege lag/stale authorization is possible. **AT RISK** until proven route-by-route. |

**Not executed in Phase E matrix:** password change impact on existing JWT (reset path increments `sessionVersion` in email-actions/token lifecycle; end-to-end session invalidation across existing clients was marked PARTIAL/AT RISK in token report), email change edge cases, disable/deletion, post-onboarding full matrix, OAuth/session linking changes.

---

## Phase D — Logout/refresh race (NOT EXECUTED)
**Reason:** no server-side JWT revocation mechanism exists. Concurrent signout/refresh tests without a fix cannot prove safe revocation and could produce misleading confidence. Execute only after authorized revocation design/implementation.

## Phase F — OAuth/Google/linking (NOT PROVEN)
No real OAuth credentials/external provider flow executed. `auth.ts` still configures Google conditionally and `allowDangerousEmailAccountLinking: true`. `PrismaAdapter(prisma)` global client + adapter tables RLS OFF on 5437 remain compatibility/authorization risks under enforced RLS/pooling. **AT RISK / NOT PROVEN.**

## Phase G — Adapter/Account/VerificationToken RLS (NOT PROVEN)
5437 prototype: `Account/Session/VerificationToken/EmailActionToken` RLS OFF per context; `User` RLS ON. No RLS/policy/privilege changes made (requires explicit proposal + authorization + migration discipline). **AT RISK / NOT PROVEN.**

## Tests executed in this audit (real evidence)
- Phase A stale-cookie reuse after logout: **executed on 3036/5437** — FAIL for reuse (A7/A8/A9), PASS for normal jar/signout flow.
- Phase E suspension/tenant/role observations: **executed on 3036/5437** — suspension invalidation PASS; tenant/role with unchanged `sessionVersion` OBSERVED.
- Static API auth marker inventory: **executed** (`authz-route-inventory.csv`, 66 routes).
- Prior supporting evidence referenced (not re-executed by this report except where noted in context): HTTP A/B isolation, DB RLS regressions 19/19+60/60+5/5, token lifecycle/concurrency 18/19 PASS+1 N/A, `tsc --noEmit` PASS.

## Tests not executed / not proven
- Phase D logout/refresh race.
- Phase F real OAuth/Google linking abuse cases.
- Phase G adapter table RLS enforcement under real adapter operations/pooling.
- Full route-by-route stale-cookie matrix (admin/financial/WMS/PDF/plan/payment/stock mutating and sensitive reads).
- Password-change/email-change/disable/delete session invalidation matrix across existing JWTs/clients.
- PgBouncer transaction pooling + tx-local GUC/JWT callback behavior.
- Supabase/production environment behavior.

## Final conclusion
**Current state: PARTIAL for DB-backed session validation behaviors, FAIL for logout-time server-side JWT revocation.** Normal logout works for the cooperating browser cookie jar, but copied pre-logout JWTs remain accepted by auth session, a protected tenant route, and session refresh on 5437 while `sessionVersion`/user state remain valid (A7–A9). Suspension is rejected (E PASS). Tenant/role changes without `sessionVersion` bump can leave old JWTs functionally valid (E OBSERVED) — DB-authoritative session fields help, but this is not equivalent to revocation and route-level permission trust is not fully proven. Token lifecycle hardening for `EmailActionToken` flows is separately evidenced (not a substitute for JWT revocation). **Do not declare production readiness.** Next step, if authorized: design-review + implement structural revocation (prefer JTI/denylist strategy A) with migration/policy/route/callback coverage, then run Phase D and full route matrix on 5437.

---

## 2026-11-05 addendum — stale-JWT sensitive routes (5437, port 3037, no code/auth changes)
**Artifacts:** RLS_STALE_JWT_SENSITIVE_ROUTES_REPORT.md, 	mp/rls-e2e-artifacts/stale-jwt-sensitive-routes.json, stale-jwt-route-results.csv. Runtime 3037/5437/mf_app_login NOBYPASSRLS; stopped, ports clear.

Quantified exposure (19 scenarios, 14 tested, 5 NOT EXECUTED): **ALTO 1** — stale JWT performed effective own-tenant mutation POST /api/customers (DB row created then cleaned). **MÉDIO 7** — stale-JWT reads (200) of own-tenant produtos, customers, report CSV export, SAF-T XML, stock warehouses/movements/balances while updated jar returned 401. **AT RISK 6** — admin proof route reached lookup with stale admin JWT (404 vs 401 for updated jar), stock returns returned domain 404 with fake IDs (auth acceptance not disproven; valid-resource mutation NOT EXECUTED), method-masked cross-tenant/read cases, desktop GET. **NOT PROVEN 5** — invoice PDF generation/issue, cron (secret-based), onboarding, desktop bootstrap POST. No cross-tenant leak/mutation observed in executed cases; not exhaustive proof. Confirms revocation gap has real read+write business impact, not only /api/produtos proof.

---

## 2026-11-05 — Architecture proposal phase (design only, NOT IMPLEMENTED)
**Constraint compliance:** no code/schema/Prisma model/migration/SQL write/role/grant/policy/RLS/auth mechanism/sessionVersion/.env changes; no Supabase/production/5436; no commits/push/merge/deploy.

**Decision (design):** recommend **A+ / E-lite** — keep session.strategy:'jwt', add CSPRNG jti per JWT, server-controlled revocation record checked **fail-closed** via a centralized validator (session resolution, /api/session/refresh, tenant/admin guards, server actions, before user-session unAsSystem/runAsAdmin paths), retain sessionVersion for global/coarse invalidation (password reset, suspension, security/global logout). **Reject C (DB sessions) now** (JWT refresh flow break, adapter RLS-OFF prototype, OAuth/pooling not proven). **Reject D-only** (global logout on every logout). **Do not auto-choose JTI+denylist without this codebase fit analysis; this recommendation follows that analysis.**

**Deliverables:** JWT_REVOCATION_ARCHITECTURE_PROPOSAL.md, JWT_REVOCATION_OPTIONS_COMPARISON.md, JWT_REVOCATION_MIGRATION_PLAN.md, JWT_REVOCATION_ACCEPTANCE_TESTS.md.

**Still required before production:** approved implementation, authorized staging migration/RLS/role design, full stale-JWT matrix + race/concurrency/multi-tenant/OAuth/pooling proof. **NOT APPROVED FOR PRODUCTION.**
