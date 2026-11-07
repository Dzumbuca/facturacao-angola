# JWT_REVOCATION_MIGRATION_PLAN
**Date:** 2026-11-05 | **Branch:** `wms-v2-e2e-staging` | Plan only — **NOT EXECUTED**.

## Preconditions (approval gates)
- Architecture approved (A+/E-lite recommended).
- Staging DB target authorized for schema/RLS/policy changes (5437 local staging for dev proof first; Supabase/production separate authorization).
- Rollback owner, maintenance window, and observability plan defined.

## Phased plan
1. **Preparation / inventory** — finalize all JWT trust paths: auth callbacks, `/api/session/refresh`, tenant/admin guards, 66 API routes, server actions, exports/PDF/SAFT/downloads, desktop bootstrap, `runAsSystem/runAsAdmin` user-session call sites. Classify cron/secret/public-token paths separately.
2. **Data model & DB access design (authorized only)** — revocation/session table + unique/indexes + expiry/cleanup; RLS policies/dedicated executor/role, least privilege, no BYPASSRLS.
3. **Central revocation service** — mint/validate `jti`, revoke, check revocation, fail closed; atomic revoke+audit where needed.
4. **NextAuth integration** — `jti` issuance in sign-in/jwt callback; revocation + `sessionVersion` in session resolution; signout/logout revocation hook (per-device).
5. **Refresh endpoint integration** — reject revoked/invalid; define rotate-old-`jti`/issue-new-`jti` semantics atomically; never refresh revoked token.
6. **API routes / server actions / guards** — wire into `getTenantReadAccess/WriteAccess`, `requirePlatformPermission`, direct-`auth()` routes, server actions; explicit guard before privileged executors on user-session flows.
7. **OAuth compatibility** — Credentials/Google both mint/check `jti`; review `allowDangerousEmailAccountLinking` separately (NOT PROVEN).
8. **Cutover strategy** — prefer short re-auth cutover; avoid accepting `jti`-less tokens except tightly bounded emergency compatibility if explicitly approved.
9. **Validation (5437 first)** — stale-JWT matrix (reads, mutation, exports/SAFT, stock, admin, refresh), logout+refresh race, multi-tenant A/B, suspension/reset/role/tenant changes, performance smoke.
10. **Rollback** — feature flag/deploy rollback; never fail open.
11. **Production readiness (later)** — authorized Supabase/production migration, role/RLS/pooling proof, real OAuth proof, full regression/security pass. **NOT APPROVED FOR PRODUCTION** until complete.

## Risks
Missed trust path, refresh bypass, RLS/policy errors, pooled-connection assumptions, stale cache authorization, token cutover UX impact.
