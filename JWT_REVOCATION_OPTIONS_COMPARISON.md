# JWT_REVOCATION_OPTIONS_COMPARISON
**Date:** 2026-11-05  
**Project:** C:\Users\Administrador\Desktop\facturacao-angola  
**Branch:** wms-v2-e2e-staging (analysis only; no code/schema/migrations/roles/grants/policies/env/DB writes)

## Current architecture (inspected)
- NextAuth/Auth.js v5 beta (
ext-auth ^5.0.0-beta.32, @auth/prisma-adapter ^2.11.3, Prisma 5.22, Next 16.4.2).
- src/lib/auth.ts: dapter: createRlsPrismaAdapter(prisma), 	rustHost:true, session.strategy:'jwt', Google conditional + llowDangerousEmailAccountLinking:true, Credentials with server-controlled admin-context email lookup (unWithRlsContext(... isAdmin:true, tenantId:null)), bcrypt, ACTIVE + email verification checks.
- JWT callback: on sign-in copies 	enantId, sessionVersion only.
- Session callback: DB revalidation per call when 	oken.sub present (unWithRlsContext user self context) — checks status ACTIVE, sessionVersion match, email verification; returns invalid session as id:'', 	enantId:null; DB 	enantId prioritized.
- POST /api/session/refresh (src/app/api/session/refresh/route.ts): decodes/encodes with 
ext-auth/jwt, cookie uthjs.session-token/__Secure-..., validates via canRefreshAuthSession + DB read, reissues JWT — **no server-side revocation check**.
- GET/POST /api/auth/[...nextauth] uses exported handlers; no middleware/proxy file found at src/middleware.ts or middleware.ts.
- Tenant/API guards: 	enant-api-access → dmin-auth → dmin-auth-core.getCurrentUser() calls uth() and DB indUserById (status ACTIVE) + tenant status in RLS contexts. Many routes use getTenantReadAccess/WriteAccess; some use uth()/getSessionTenantId directly. Privileged executors: unAsSystem/runAsAdmin/runAsAuth/runWithTenant in 	enant-db.ts.
- Prisma adapter RLS prototype (5437): Account/Session/VerificationToken/EmailActionToken RLS OFF; User RLS ON. Adapter wrapper uses unAsSystem/unWithUser narrowly.

## Confirmed problem (5437 evidence)
Logout clears cooperating browser jar, but copied pre-logout JWT remains accepted by /api/auth/session, protected routes (e.g. /api/produtos, customers, reports/SAFT export, stock reads), /api/session/refresh, and allowed **effective mutation** (POST /api/customers, DB row created, cleaned). sessionVersion unchanged on logout. Admin proof route accepted stale admin JWT past auth boundary (404 vs 401). 7 reads + 1 write exposed; 6 AT RISK; 5 NOT PROVEN; 0 critical observed (not absence). Source: RLS_STALE_JWT_SENSITIVE_ROUTES_REPORT.md, RLS_JWT_REVOCATION_REPORT.md.

## Option comparison

| Option | Immediate logout revocation of copied JWT? | Per-device/session logout? | Global revoke (ll devices/password/suspend) | Revocation survives unchanged sessionVersion? | DB cost | OAuth/adapter impact | Complexity | Main risks |
|---|---:|---:|---:|---:|---|---|---:|---|
| **A. JTI + denylist/revocation record** | Yes, if checked before trust | Yes (revoke one JTI/session row) | Yes (bulk by user + optionally bump sessionVersion) | Yes | 1 indexed lookup/write per revoke + lookup on validation path (cache possible only with strict invalidation/fail-closed discipline) | Low if JWT strategy kept; must mint/propagate jti in jwt callback/sign-in | Medium | Missing central check path; cache inconsistency; table/RLS/executor design; PgBouncer tx-local context nuances for revocation writes/reads |
| **B. Session registry (active sessions) + JWT** | Yes, if JWT carries session id and registry checked | Yes | Yes | Yes | Lookup/heartbeat/update patterns vary; can be heavier | Low-medium | Medium-high | Requires session lifecycle model; clock/cleanup; still JWT unless fully migrated |
| **C. Database sessions (strategy:'database')** | Yes (delete/invalidate session row) | Yes | Yes | Yes | Read/write per session validation/use (NextAuth behavior dependent) | **High**: adapter Session methods become primary; adapter tables RLS OFF prototype; pooling/RLS not proven; JWT assumptions in custom refresh route break | High | Migration/regression across Credentials+Google, custom /api/session/refresh, cookie semantics, existing JWTs, RLS posture |
| **D. Increment sessionVersion on logout** | Partially (only via current DB version checks) | **No** (revokes all user sessions) | Yes (already natural for password reset flows) | No, it *changes* version; cannot revoke one device | Cheap (single user row update + existing checks) | Low | Low | Bad UX/security granularity; race if not atomic with client expectation; does not address stolen single session without global logout |
| **E. Hybrid (JTI/session registry + sessionVersion + centralized guard)** | Yes | Yes | Yes | Yes | Medium (targeted lookups + rare user-version checks) | Low-medium if JWT retained | Medium-high but bounded if scoped | Overengineering; multiple sources of truth if responsibilities unclear |

## Evaluation by required criteria
- **A (JTI + denylist):** cryptographic random jti (>=128-bit) per issued JWT; store revocation keyed by jti hash or jti plus userId, 	enantId? nullable for auth-only context, eason, evokedAt, expiresAt (copied/bounded to JWT exp). Check on sign-out target? better revoke on sign-out action and reject on subsequent validation. Atomic revoke+audit in same transaction where possible. Cleanup by expiresAt. Fail closed for protected ops on lookup failure (except carefully bounded non-sensitive paths, none recommended). Concurrency safe with unique jti. No BYPASSRLS.
- **B:** similar to A but models active sessions; useful for “list devices / revoke device”; more state. With JWT still stateless transport, needs sid claim.
- **C:** strongest native revocation semantics but highest migration risk in this codebase (JWT-specific refresh endpoint, RLS-off Session table, unproven OAuth/pooling). Not a minimal safe first step.
- **D:** reuses existing sessionVersion checks in session callback/refresh/admin DB checks, but **cannot satisfy** “logout invalidates only that session” and breaks multi-device expectations; still useful as coarse emergency/global control.
- **E:** best security coverage if designed as: **sessionVersion = coarse global invalidation** (password reset, account suspension/security incident, optional global logout); **jti/session record = per-session logout/revocation**; **single centralized validator** used by session callback, refresh, API/server-action guards, and before privileged executors.

## Recommendation (preliminary, design-only)
**Recommended direction: E-lite / A+ — keep JWT strategy, add per-JWT revocation identifier (jti) + revocation/session record + centralized fail-closed validator, retain sessionVersion for global/user-state invalidation.** Do **not** migrate to DB sessions now. Do **not** rely on logout-time sessionVersion bump alone.

**Why:** confirms immediate revocation of copied JWTs (the confirmed gap), preserves existing JWT/custom refresh/OAuth integration surface, supports per-device logout and global invalidation, and aligns with current RLS/tenant executors if designed as server-controlled infrastructure data. C is deferred until adapter/RLS/pooling/OAuth are proven. D alone is rejected as primary mechanism.
