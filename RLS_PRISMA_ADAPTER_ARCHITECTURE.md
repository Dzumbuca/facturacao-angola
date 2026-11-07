# RLS_PRISMA_ADAPTER_ARCHITECTURE.md
**Scope:** Machine Facturas NextAuth/Auth.js + `@auth/prisma-adapter` + Prisma + PostgreSQL RLS on `mf_rls_staging` (`127.0.0.1:5437`) only. **Not production.**

## Previous architecture (before this phase)
- `src/lib/auth.ts` used `PrismaAdapter(prisma)` with the global Prisma singleton (`src/lib/prisma.ts`).
- Session strategy: **JWT** (`session.strategy='jwt'`).
- Credentials provider performed server-controlled email lookup via `runWithRlsContext(... isAdmin:true)`; session callback validated self user via `runWithRlsContext(userId)`.
- 5437 RLS prototype: `Account, Session, VerificationToken, EmailActionToken` **RLS OFF**; `User`, `EmailRequestLimit` **RLS ON**. App login `mf_app_login` is `NOSUPERUSER NOBYPASSRLS`.
- Problem: adapter operations bypassed RLS executor patterns and were not documented/tested as a coherent RLS-compatible boundary. Global adapter can also touch `User` (RLS ON) without explicit context.

## Solution applied (minimal, additive)
- Added `src/lib/auth-prisma-adapter.ts` exporting `createRlsPrismaAdapter(prisma)`.
- `src/lib/auth.ts` now uses `createRlsPrismaAdapter(prisma)` instead of raw `PrismaAdapter(prisma)`.
- The wrapper keeps `@auth/prisma-adapter` behavior by constructing `PrismaAdapter(tx)` per operation and executing inside transaction-local RLS contexts via existing `tenant-db` executors:
  - **System context** (`runAsSystem` => `app.is_admin=true`, no tenant/user): server-controlled bootstrap/identity operations where no authenticated user context is safe/available — `createUser`, `getUserByEmail`, `getUserByAccount`, `unlinkAccount`, `getAccount`, `getSessionAndUser` lookup, `updateSession`, `deleteSession`, `createVerificationToken`, `useVerificationToken`, authenticators. Rationale: these are Auth.js server-side operations; User RLS permits admin; adapter tables are RLS OFF in this prototype.
  - **User context** (`runWithRlsContext(userId, tenantId null, isAdmin false)`) when a known user id is present: `getUser`, `updateUser`, `deleteUser`, `linkAccount`, `createSession`, `listAuthenticatorsByUserId`. Rationale: respects User self policy; avoids unnecessary admin context.
- No BYPASSRLS roles added. No RLS disabled. No schema/policy/permission changes applied.

## RLS/context propagation
- Each adapter method runs inside `prisma.$transaction` via `runWithRlsContext/runAsSystem`, which sets `set_config('app.tenant_id'|'app.user_id'|'app.is_admin', ..., true)` (transaction-local). No cross-request context reuse in app code.
- `PrismaAdapter(tx)` is instantiated with the transaction client for that operation, so adapter queries participate in the same transaction/GUC scope.
- This does **not** prove PgBouncer/Supabase transaction-pooling safety (pooler may switch backend connections between transactions; GUCs are transaction-local but connection affinity/adapter behavior in pooled production must be validated).

## Table classification (5437 prototype)
| Table | RLS | Policies | NextAuth/adapter use | Actor | Context in wrapper | Risk |
|---|---|---|---|---|---|---|
| `Account` | OFF | none | OAuth linking, account lookup | NextAuth server | system/user-as-metadata for link | AT RISK until RLS policy design validated |
| `Session` | OFF | none | DB sessions (unused with JWT) | NextAuth server | system | AT RISK if DB-session strategy used |
| `VerificationToken` | OFF | none | create/use verification tokens | NextAuth server | system | AT RISK until RLS policy design validated |
| `EmailActionToken` | OFF | none | app flows (not adapter) | app server | `runAsSystem` in email-actions | AT RISK |
| `User` | ON | `rls_user_self_tenant_admin` | adapter user CRUD/lookups + app auth | NextAuth/app server | system for bootstrap/email/account lookup; user for self-by-id | PARTIAL — bootstrap lookups privileged server-only |
| `EmailRequestLimit` | ON | admin-only | rate limit infra | app server | system | PASS for narrow use |

## Adapter operation map
| Adapter method | Table(s) | Context | Notes |
|---|---|---|---|
| `createUser` | User | system | server-controlled |
| `getUser` | User | user (by id) | self-policy path |
| `getUserByEmail` | User | system | bootstrap lookup; narrow trust boundary |
| `getUserByAccount` | Account, User | system | joins account->user |
| `updateUser` | User | user | known id |
| `deleteUser` | User | user | known id |
| `linkAccount` | Account | user metadata when userId present | server-controlled OAuth callback path |
| `unlinkAccount` | Account | system | server-controlled |
| `getAccount` | Account | system | server-controlled |
| `getSessionAndUser` | Session, User | system | DB-session path; JWT strategy not using it |
| `createSession` | Session | user metadata when userId present | DB-session path |
| `updateSession` | Session | system | DB-session path |
| `deleteSession` | Session | system | DB-session path |
| `createVerificationToken` | VerificationToken | system | token secret server-side |
| `useVerificationToken` | VerificationToken | system | atomic consume |

## Evidence
- `tsc --noEmit`: **PASS**.
- DB adapter-context probe (5437, NOBYPASSRLS role simulation): **PASS 7/7** — `tmp/rls-e2e-artifacts/adapter-context-probe.json` (create/use/reuse verification token, bootstrap email lookup, self user, cannot read other user by id under user context, account table accessible in system tx).
- Isolated Next runtime (3030, 5437 `mf_app_login`, RLS adapter enabled): **PASS 8/8** — `tmp/rls-e2e-artifacts/auth-adapter-http.json` (Credentials A/B login, session independence, invalid password, nonexistent user, logout, B produtos own-only regression, anon produtos blocked).

## Not executed / not proven
- OAuth/Google callback, linking, account persistence, dangerous email linking behavior, provider state — **NOT EXECUTED** (no external credentials).
- DB-session strategy behavior (`Session` table) — **NOT EXECUTED** (app uses JWT).
- NextAuth `createVerificationToken/useVerificationToken` HTTP flows — **NOT EXECUTED** (app has custom email-action token flows).
- Full register/verify/resend/change-email/forgot/reset/refresh/onboarding HTTP matrix — **NOT EXECUTED** in this adapter pass.
- Supabase/PgBouncer pooling, production role/policy parity, 5436/prod — **NOT EXECUTED / NOT IN SCOPE**.

## Limitations / proposal for next structural step (not applied)
- Adapter bootstrap methods use `runAsSystem` (admin GUC) because User RLS currently allows self/tenant/admin, not email-based pre-auth lookup. This is narrow and server-controlled but still privileged. A stricter design would introduce dedicated auth-safe policies/functions or a narrowly scoped auth executor role/flow with explicit grants, validated under concurrency and OAuth — **requires architectural review and approved SQL changes; not applied**.
- Consider enabling RLS on adapter tables only with policies proven against all NextAuth adapter operations and OAuth edge cases; current prototype keeps them RLS OFF.
