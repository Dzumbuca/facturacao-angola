# RLS_NEXTAUTH_INTEGRATION_REPORT.md
**Status:** **PARTIAL — Credentials/session/logout basics PASS on isolated 5437 runtime; PrismaAdapter/OAuth/refresh/onboarding/verify/reset NOT PROVEN.**

## Scope audited
- `src/lib/auth.ts` (NextAuth config, PrismaAdapter, Credentials, JWT/session callbacks)
- `src/lib/prisma.ts` (global Prisma singleton)
- `src/lib/tenant-db.ts` (RLS executors)
- NextAuth callbacks/config; auth routes under `src/app/api/auth/*`
- Session/onboarding touchpoints: `api/session/refresh`, `api/onboarding/company`

## Observed architecture
- `PrismaAdapter(prisma)` uses the **global Prisma client**.
- 5437 prototype keeps adapter tables RLS OFF: `Account, Session, VerificationToken, EmailActionToken`.
- Credentials `authorize` uses server-controlled `runWithRlsContext(... isAdmin:true, tenantId:null)` for narrow email lookup (User RLS allows self-by-id/tenant/admin, not arbitrary pre-session email lookup). Password/status/verification checked before session issuance.
- `session` callback reads self user by `app.user_id` in explicit RLS context (self policy).
- Auth bootstrap/email flows use narrow system/auth contexts in code (`register/forgot/resend/change-unverified-email`, `email-actions`); **HTTP not executed**.

## Executed (isolated Next runtimes targeting 5437 `mf_app_login`, NOBYPASSRLS)
| Check | Result | Evidence |
|---|---|---|
| Runtime DB identity | **PASS** | `tmp/rls-e2e-artifacts/runtime-db-identity.json` — `mf_rls_staging/mf_app_login`, no super/bypass, Tenant RLS true, app context matches session. |
| Credentials login A | **PASS** | `http-isolation-ab-extended.json`, `http-auth-admin-probe.json` |
| Credentials login B | **PASS** | same |
| Credentials login admin fixture | **PASS** | `http-auth-admin-probe.json` |
| Session read / tenant separation A vs B | **PASS** | independent cookies/jars, different `tenantId` values |
| Logout invalidation | **PASS** | signout 302, subsequent session has no user |
| Unauth guarded endpoints | **PASS** (sampled) | `/api/produtos`, `/api/plan/payment` blocked 401/403 |

## Not Executed
| Check | Status | Reason |
|---|---|---|
| Register / account creation HTTP | **NOT EXECUTED** | Would create state; fixtures pre-seeded; flow not exercised. |
| Email verify / resend / change-unverified-email HTTP | **NOT EXECUTED** | Token/email flows not exercised. |
| Forgot/reset password HTTP | **NOT EXECUTED** | — |
| VerificationToken / EmailActionToken lifecycle HTTP | **NOT EXECUTED** | — |
| Session refresh HTTP | **NOT EXECUTED** | Code changed earlier; no runtime proof. |
| Onboarding HTTP (null `tenantId`) | **NOT EXECUTED** | — |
| OAuth Google/linking/callback/account/session persistence | **NOT EXECUTED** | External credentials unavailable; adapter/global Prisma risk remains. |
| PrismaAdapter compatibility under enforced RLS/pooling | **NOT PROVEN** | Global adapter + adapter tables RLS OFF prototype. |

## Risks
- **AT RISK:** `PrismaAdapter(prisma)` global client; adapter behavior under full RLS enforcement/transaction pooling not proven.
- **AT RISK:** Credentials email lookup uses privileged server-controlled admin context; acceptable only as narrow bootstrap path pending auth executor/policy finalization. Client input cannot set `app.is_admin`.
- **AT RISK:** Adapter tables RLS OFF is a compatibility prototype, not a production security posture.
- Next dev logs `.env.local,.env` loaded; launchers inject critical 5437 vars but precedence remains a risk.

**Conclusion:** Credentials login/session basics **PASS** on 5437 NOBYPASSRLS. **Do not declare full NextAuth/adapter/OAuth compatibility.**
