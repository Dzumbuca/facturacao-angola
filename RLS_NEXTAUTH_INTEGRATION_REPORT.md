# RLS_NEXTAUTH_INTEGRATION_REPORT.md
**Status:** **PARTIAL — Credentials/session/logout basics PASS on isolated 5437 runtime; PrismaAdapter/OAuth/refresh/onboarding/verify/reset NOT PROVEN.**

## Scope audited
- `src/lib/auth.ts` (NextAuth config, PrismaAdapter, Credentials, JWT/session callbacks)
- `src/lib/auth-prisma-adapter.ts` (RLS context wrapper)
- `src/lib/prisma.ts` (global Prisma singleton)
- `src/lib/tenant-db.ts` (RLS executors)
- `src/lib/email-actions.ts`
- NextAuth/auth routes: `src/app/api/auth/*` (including verify/reset flows)
- Session/onboarding touchpoints: `api/session/refresh`, `api/onboarding/company`

## Observed architecture
- `PrismaAdapter(prisma)` uses the **global Prisma client**.
- 5437 prototype keeps adapter tables RLS OFF: `Account, Session, VerificationToken, EmailActionToken`.
- Credentials `authorize` uses server-controlled `runWithRlsContext(... isAdmin:true, tenantId:null)` for narrow email lookup (User RLS allows self-by-id/tenant/admin, not arbitrary pre-session email lookup). Password/status/verification checked before session issuance.
- `session` callback reads self user by `app.user_id` in explicit RLS context (self policy).
- Auth bootstrap/email flows use narrow system/auth contexts in code (`register/forgot/resend/change-unverified-email`, `email-actions`); selected flows HTTP-tested on 5437 (see below), full lifecycle not proven.

## Executed (isolated Next runtimes targeting 5437 `mf_app_login`, NOBYPASSRLS)
| Check | Result | Evidence |
|---|---|---|
| Runtime DB identity | **PASS** | `tmp/rls-e2e-artifacts/runtime-db-identity.json` — `mf_rls_staging/mf_app_login`, no super/bypass, Tenant RLS true, app context matches session. |
| Credentials login A | **PASS** | `http-isolation-ab-extended.json`, `http-auth-admin-probe.json`, `auth-flows-final.json` |
| Credentials login B | **PASS** | same |
| Credentials login admin fixture | **PASS** | `http-auth-admin-probe.json` |
| Invalid credentials | **PASS** (no session user) | `auth-flows-final.json` |
| No-tenant synthetic fixture login | **PASS** (session without tenantId) | `auth-flows-final.json` |
| Session read / tenant separation A vs B | **PASS** | independent cookies/jars, different `tenantId` values |
| Logout invalidation | **PASS** | signout 302, subsequent session has no user (`http-auth-admin-probe.json`) |
| Unauth guarded endpoints | **PASS** (sampled) | `/api/produtos`, `/api/plan/payment` blocked 401/403 |
| Verify-email nonexistent/invalid token HTTP | **PASS** (controlled 400, no 500) | `auth-flows-final.json` (port 3033, 5437 launcher) |
| Reset-password nonexistent/invalid token + short password HTTP | **PASS** (controlled 400) | `auth-flows-final.json` |
| Forgot-password/resend-verification generic responses | **PASS** (200 generic) | `auth-flows-final.json` |
| Onboarding unauth/valid/idempotent (no-tenant fixture) | **PASS** | `auth-flows-final.json` (synthetic 5437 tenant created; fixture restored after test) |
| Session refresh after onboarding context | **PASS** (200) | `auth-flows-final.json` |

## 2026-11-05 focused fixes (working tree, not committed)
- **Cause of observed 500s:** `src/lib/email-actions.ts` used nested `tx.$transaction(async (inner)=>...)` inside `runAsSystem` callbacks. The Prisma client passed by `runAsSystem` is already a transaction client (with admin RLS GUCs set); calling `$transaction` on it raised `tx.$transaction is not a function` in the Next runtime, producing HTTP 500 on verify/reset token paths.
- **Correction:** removed nested `tx.$transaction`/`inner` usage in `sendEmailActionToken`, `verifyEmailToken`, `resetPasswordWithToken`, and `unsubscribeFromMarketing`; operations run in the single `runAsSystem` transaction. `verifyEmailToken`/`resetPasswordWithToken` now use `FOR UPDATE` row lock + conditional `updateMany` by `id/userId/purpose/consumedAt null/expiresAt>now` inside the same transaction to harden single-use under concurrency. `Serializable` not separately requested.
- **Same-class preventive fix:** removed nested `tx.$transaction` inside `runAsSystem` in `src/app/api/auth/register/route.ts` and `src/app/api/auth/change-unverified-email/route.ts` (same runtime failure pattern; not HTTP-reproduced in this run).
- **Onboarding bootstrap:** `src/app/api/onboarding/company/route.ts` uses `runAsSystem` for tenant creation bootstrap and guarded user-link update; no auth mechanism change.
- **Files modified:** `src/lib/email-actions.ts`, `src/app/api/onboarding/company/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/change-unverified-email/route.ts`.
- **Instrumentation:** temporary `_debug` fields were added to verify/reset routes during diagnosis and removed; no debug routes left active.

## 2026-11-05 token lifecycle + concurrency (5437, 3034)
Evidence: `tmp/rls-e2e-artifacts/token-lifecycle-concurrency.json`, `RLS_TOKEN_LIFECYCLE_REPORT.md`. **18 PASS / 0 FAIL / 1 NOT APPLICABLE**.
- PASS: verify/reset nonexistent, invalid format, expired (not consumed), consumed, wrong purpose (not consumed), valid consume (temp synthetic user; DB state verified), reuse after consume, cross-user boundary (token affects owner only; A unchanged), **concurrency same token** verify `200/400`, reset `400/200` with single consume and single sessionVersion/password mutation.
- NOT APPLICABLE: schema has no revoked field; invalidation via `consumedAt`/`expiresAt` and issuance invalidation of prior unconsumed same-purpose tokens.
- NOT EXECUTED/PROVEN: change-unverified-email token lifecycle, NextAuth `VerificationToken` adapter lifecycle, mailbox-intercepted issuance→consume, full session invalidation matrix after reset/verify across clients, OAuth/PrismaAdapter, PgBouncer/Supabase, production. B synthetic fixture password restored after boundary test; sessionVersion may differ.

## Not Executed / Not Proven
| Check | Status | Reason |
|---|---|---|
| Verify/reset with expired token | **NOT EXECUTED** | No safe synthetic `EmailActionToken` fixture created; DB had no EmailActionToken rows on inspection. |
| Verify/reset with consumed token | **NOT EXECUTED** | No safe synthetic fixture. |
| Verify/reset with token belonging to another user | **NOT EXECUTED** | No safe synthetic cross-user fixture. |
| Verify/reset with valid token (full success path) | **NOT EXECUTED** | Would consume token / mutate password/session; no safe fixture prepared. |
| Register / account creation HTTP | **NOT EXECUTED** | Would create state; fixtures pre-seeded. |
| VerificationToken / EmailActionToken lifecycle HTTP (end-to-end issuance→consume) | **NOT EXECUTED** | — |
| Session refresh full matrix / onboarding all edge cases | **PARTIAL** | One refresh-after-onboarding case PASS. |
| OAuth Google/linking/callback/account/session persistence | **NOT EXECUTED** | External credentials unavailable; adapter/global Prisma risk remains. |
| PrismaAdapter compatibility under enforced RLS/pooling | **NOT PROVEN** | Global adapter + adapter tables RLS OFF prototype. |
| Expired/invalid session, post-logout access matrix beyond sampled case | **PARTIAL / NOT EXECUTED** | Logout PASS; expiry/invalid-token cases not fully executed. |

## Risks
- **AT RISK:** `PrismaAdapter(prisma)` global client; adapter behavior under full RLS enforcement/transaction pooling not proven.
- **AT RISK:** Credentials email lookup uses privileged server-controlled admin context; acceptable only as narrow bootstrap path pending auth executor/policy finalization. Client input cannot set `app.is_admin`.
- **AT RISK:** Adapter tables RLS OFF is a compatibility prototype, not a production security posture.
- **AT RISK:** Token verify/reset flows now proven only for nonexistent/invalid/short-password controlled errors; expired/consumed/cross-user/valid success paths remain unproven.
- **AT RISK:** 5437 schema drift (`public._prisma_migrations` absent vs migrate status; `User.tenantRole` NOT NULL/default USER in 5437 while Prisma schema marks optional) — staging compatibility only.
- Next dev logs `.env.local,.env` loaded; launchers inject critical 5437 vars but precedence remains a risk.

**Conclusion:** Credentials login/session basics and selected verify/reset/onboarding/resend/forgot HTTP error handling **PASS** on 5437 NOBYPASSRLS for executed cases. **Do not declare full NextAuth/adapter/OAuth/production compatibility.**
