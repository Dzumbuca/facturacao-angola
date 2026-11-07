# JWT_REVOCATION_ARCHITECTURE_PROPOSAL
**Date:** 2026-11-05
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola` | **Branch:** `wms-v2-e2e-staging`
**Phase:** design/analysis only. **No code, schema, Prisma model, migration, SQL write, role/grant/policy/RLS/auth/sessionVersion/`.env`/adapter behavior changes. No Supabase/production/5436. No commits/push/merge/deploy.**

## Executive recommendation
Adopt **A+ / E-lite** while keeping `session.strategy:'jwt'`:
1. **Per-JWT identity:** mint cryptographically strong `jti` (>=128-bit, CSPRNG) for every issued JWT; include `iat`, `exp`, `sub`, bounded `sessionVersion`. Optional `sid` = same logical session id if rotation/device UX is added later.
2. **Revocation record:** server-controlled infrastructure table (proposed `AuthJwtRevocation` / `AuthSession`) with unique `jti` or `jtiHash`, `userId`, `reason`, `revokedAt`, `expiresAt`, optional `tenantIdAtIssue` metadata (never authorization source), optional `actorUserId`/audit fields. **RLS ON or strict dedicated access path; no `BYPASSRLS`; no RLS-off convenience.**
3. **Global invalidation retained:** keep `sessionVersion` for password reset, security events, suspension, forced global invalidation. Per-device logout revokes only that `jti`; it must **not** increment `sessionVersion` unless explicitly "logout all devices".
4. **Central validator (fail closed):** `validateActiveAuthToken`/equivalent checks signature/expiry (NextAuth), `sub`, DB user status/version/verification, and revocation state. Used by session resolution, `/api/session/refresh`, tenant/admin guards, server actions, and before `runAsSystem`/`runAsAdmin` on user-initiated requests.
5. **Fail closed:** revocation-store read failure/timeout => deny protected access (401/503 by context). Never treat error/stale cache uncertainty as valid for revoked tokens.

**Not recommended now:** database sessions migration (breaks JWT refresh flow, adapter tables RLS OFF prototype, OAuth/pooling not proven); logout-time global `sessionVersion` bump as sole fix (revokes all devices); JWT-only trust; RLS-off revocation table; client-controlled revocation.

## Confirmed problem (5437 evidence)
`RLS_STALE_JWT_SENSITIVE_ROUTES_REPORT.md`, `RLS_JWT_REVOCATION_REPORT.md`: pre-logout JWT copy accepted after signout while `sessionVersion` unchanged. Reads exposed: `/api/produtos`, `/api/customers`, `/api/reports/export`, `/api/invoices/generate-saft`, `/api/stock/warehouses|movements|balances`. **Effective mutation:** `POST /api/customers` created DB row (cleaned). Admin proof route accepted stale admin JWT past auth boundary (404 vs 401). `/api/session/refresh` reissued when token/user valid. 7 reads + 1 write, 6 AT RISK, 5 NOT PROVEN.

## Current codebase (inspected)
- `src/lib/auth.ts`: NextAuth v5 beta, `session.strategy:'jwt'`, `createRlsPrismaAdapter(prisma)`, Google conditional + `allowDangerousEmailAccountLinking:true`, Credentials with admin-context email lookup, JWT callback copies `tenantId`/`sessionVersion`, session callback DB-validates user (self RLS context) and sets invalid user to `id:''`/`tenantId:null`. No signout revocation hook, no `jti`.
- `src/app/api/session/refresh/route.ts`: manual `decode/encode` (`next-auth/jwt`), checks `canRefreshAuthSession` + DB; **reissues without revocation check**.
- `src/lib/session-refresh-security.ts`: status/version/email only.
- `src/lib/auth-prisma-adapter.ts`: RLS-aware wrapper; Account/Session/VerificationToken/EmailActionToken RLS OFF prototype (5437), User RLS ON.
- `src/lib/tenant-db.ts`: `runWithRlsContext/runWithTenant/runAsAdmin/runAsAuth/runAsSystem` set tx-local GUCs; executors do not validate session revocation.
- `src/lib/admin-auth-core.ts` + `admin-auth.ts`: `auth()` + DB user/tenant checks; feeds `getTenantReadAccess/WriteAccess`. Many routes also call `auth()`/`getSessionTenantId` directly.
- No `src/middleware.ts`/`middleware.ts` found; route protection is callback/guards/routes.
- Server actions exist (e.g. dashboard/admin/lib actions); coverage must be inventoried in implementation phase.

## Required validation points
| Point | Current gap | Design requirement |
|---|---|---|
| Sign-in / JWT issuance | No `jti` | Mint `jti`, `iat`; bind to `sub`; server-generated only |
| `jwt` callback | Copies limited claims | Preserve `jti`; define rotation/update behavior explicitly |
| `session` callback / `auth()` | Checks user/version/status; no revocation | Reject revoked `jti` before returning valid session |
| `/api/session/refresh` | Decodes/encodes directly | Validate revocation + user + version; reject revoked; define old/new `jti` rotation atomically |
| Tenant/admin API guards | Depend on `auth()`/DB state | Central validator before data access; fail closed |
| Server Actions | Mixed patterns | Mandatory central guard for tenant/admin/sensitive actions |
| Before `runAsSystem/runAsAdmin` (user-initiated) | Caller responsibility implicit | Validate session/revocation/authorization immediately before privileged executor; cron/secret flows use separate explicit auth |
| Exports/PDF/SAFT/downloads/offline bootstrap | Sensitive paths | Same revocation gate; treat as high risk |

## Proposed revocation data model (design only)
| Field | Purpose |
|---|---|
| `jti` / `jtiHash` (unique, indexed) | Lookup key; hash option avoids storing raw token id if desired |
| `userId` | Owner binding; prevents cross-user revocation |
| `reason` | logout, logout_all, password_change, suspended, security, admin |
| `revokedAt` | Revocation timestamp |
| `expiresAt` | JWT expiry bound; enables cleanup |
| `issuedAt` | Optional audit/debug |
| `tenantIdAtIssue` (nullable) | Metadata only; **not** authorization |
| `actorUserId`/metadata | Admin/security audit |

RLS: **deny by default, explicit policies** or dedicated executor/role pattern; self-user can only affect own sessions where applicable; platform admin actions explicit and audited. No cross-tenant reads. No BYPASSRLS app runtime.

## Performance & availability
- Unique index lookup on `jti`/`jtiHash` is O(log n), small row; acceptable if measured.
- **DB authoritative** preferred for correctness; cache only if globally consistent, invalidation-safe, and fail-closed on uncertainty. Requirement: stale cache must not authorize revoked token.
- Fail-closed on DB timeout/error for protected operations.
- PgBouncer/transaction pooling: use simple indexed queries; keep transaction scope narrow; avoid pooled-connection GUC leakage assumptions.
- Cleanup job deletes expired rows (`expiresAt` + grace) in system/admin context, outside request path.

## OAuth / NextAuth / migration
- Mint `jti` for Credentials and Google/OAuth callbacks alike.
- Keep JWT strategy; do not migrate to DB sessions now.
- Existing JWTs lacking `jti`: prefer cutover with short re-auth window; avoid long dual-accept unless tightly bounded and risk-approved.
- `allowDangerousEmailAccountLinking:true` remains security risk (NOT PROVEN) — out of scope to change, but revocation must bind to resolved `sub`.

## Target security matrix
| Scenario | Required |
|---|---|
| Valid login | Authorized |
| Normal logout (device) | That `jti` rejected |
| Copied pre-logout JWT | Rejected |
| Logout other device | Only targeted session rejected |
| Global revoke / logout all | All user sessions rejected |
| Password changed/reset | Previous sessions rejected |
| Account suspended | Rejected |
| Role changed | Old permissions not accepted |
| Tenant changed/removed | Old tenant context rejected |
| Expired JWT | Rejected |
| Missing/unknown required `jti` | Rejected |
| DB unavailable | Fail closed |
| Refresh revoked JWT | Rejected, no new token |
| User-session reaching `runAsSystem`/admin path | Revocation/authz validated before privilege |

## Risks / residual
- Coverage gaps in API routes/server actions; requires inventory-driven implementation.
- Refresh token rotation semantics must be atomic and explicit.
- Redis/cache adds operational complexity and stale-authorization risk if mishandled.
- Multi-instance/serverless environments make in-memory revocation invalidation unsafe alone.

## Final decision
**Recommend A+ (JWT + `jti` revocation record + centralized fail-closed validator + `sessionVersion` for global/coarse invalidation).** Reject C now, reject D-only, keep B as future device-management evolution. **NOT APPROVED FOR PRODUCTION** until implemented and fully validated.
