# Security Fixes Report — Machine Facturas (updated 2026-11-06 follow-up)
Scope: minimal, evidence-backed fixes in authorized code paths. No DB/RLS/GRANT/migration/production changes. Preexisting worktree preserved.

## Fixes / mitigations applied
| File | Status | Change | Rationale | Tests |
|---|---|---|---|---|
| `src/app/api/stock/adjustments/route.ts` (untracked, hardened earlier) | MITIGATED | INCREASE uses `product.updateMany({id,tenantId})` + guard. | Defense-in-depth tenant scoping. | `vitest run src/app/api/stock/adjustments/route.test.ts` **3/3 PASS**. |
| `src/app/api/stock/purchase/receptions/route.ts` (untracked) | MITIGATED | PO status guard, item/product/lot ownership checks, tenant-scoped product increment, idempotency key includes `purchaseOrderItemId`, PO marked received after items, error mapping. | Ownership/state/idempotency hardening inside `runWithTenant`. | `vitest run src/app/api/stock/purchase/receptions/route.test.ts` **9/9 PASS** (new). |
| `src/app/api/stock/reservations/[id]/route.ts` (untracked) | MITIGATED | ACTIVE-only actions, tenant-scoped `stockReservation`/`product.updateMany` guards, safe JSON parse. | Prevent invalid transitions/double-release and add tenant scoping. | `vitest run src/app/api/stock/reservations/[id]/route.test.ts` **8/8 PASS** (new). |
| `src/app/api/stock/transfers/[id]/route.ts` (untracked) | MITIGATED | Strict state transitions, tenant-scoped product/item updates, improved idempotency context, CANCEL blocked for RECEIVED. | State/tenant/idempotency hardening. | `vitest run src/app/api/stock/transfers/[id]/route.test.ts` **2/2 PASS**. |
| `src/app/api/stock/adjustments/route.test.ts` (untracked) | FIXED (test compat) | Mock supports `product.updateMany` `{count:1}`. | Keep tests aligned with hardened route. | Included in adjustments run. |
| `src/app/api/stock/purchase/receptions/route.test.ts` (untracked) | NEW | Route security tests: unauth tenant, payload, cross-tenant/missing PO/product/lot, repeated PO, invalid item, tx failure, tenant-scoped assertions/idempotency. | Covers requested scenarios where representable in unit/route test. | **9/9 PASS**. |
| `src/app/api/stock/reservations/[id]/route.test.ts` (untracked) | NEW | Route security tests: unauth, cross-tenant/missing reservation, invalid state, repeated action, cross-tenant product defense, tx failure, tenant-scoped updates, concurrency-like `count=0`. | Covers requested scenarios where representable. | **8/8 PASS**. |
| `src/lib/tenant-db.ts` (tracked, not previously modified in git status) | MITIGATED (F-004) | Added `server-only`, `PRIVILEGED_RLS` symbol marker, `assertPrivileged`; `runWithTenant` now ignores `isAdmin` escalation and always sets `isAdmin:false`; `runAsAdmin`/`runAsSystem` require marker. | Centralized guardrail against accidental/arbitrary privileged RLS context. | `src/lib/tenant-db.test.ts` **6/6 PASS** (new); `src/lib/admin-auth.test.ts` **11/11 PASS** regression. |
| `src/app/api/plan/payment/proof/[id]/route.ts` (tracked) | MITIGATED (F-004 caller) | Passes `PRIVILEGED_RLS` after platform role authorization. | Compatibility with hardened helper; preserves prior authz gate. | Covered by helper contract/admin-auth regression (route-specific test not added). |
| `src/lib/email-actions.ts` (preexisting modified) | MITIGATED (F-004 caller, minimal) | Imports/passes `PRIVILEGED_RLS` to existing `runAsSystem` calls; preserves preexisting token-hardening diff. | Compatibility without removing preexisting work. | No dedicated test run; diff reviewed for minimal scope. |
| `src/lib/auth-prisma-adapter.ts` (untracked) | MITIGATED (F-004 caller) | Passes `PRIVILEGED_RLS` to system-context adapter operations. | Compatibility with hardened helper. | No dedicated test run. |
| `src/app/api/auth/[...nextauth]/route.ts` (tracked) | FIXED (F-005) | Removed cookie name/length console logging. | Reduce unnecessary auth metadata exposure in logs. | No behavior-changing test added; rate-limit/handler path preserved. |
| `src/app/api/stock/movements/[id]/route.ts` (preexisting modified) | MITIGATED (F-006) | Read uses `runWithTenant`; DELETE still disabled/403. | Align read path with central RLS helper while preserving behavior. | No dedicated route test added. |

## Validation executed
- `vitest run src/lib/tenant-db.test.ts` — **6/6 PASS**
- `vitest run src/lib/admin-auth.test.ts` — **11/11 PASS**
- `vitest run src/lib/ad-unlock-core.test.ts` — **6/6 PASS**
- `vitest run src/app/api/stock/adjustments/route.test.ts src/app/api/stock/transfers/[id]/route.test.ts src/app/api/stock/purchase/receptions/route.test.ts` — **14/14 PASS**
- `vitest run src/app/api/stock/reservations/[id]/route.test.ts` — **8/8 PASS**

## Not executed / blocked
- Full TypeScript/ESLint/Next build: not run (large repo, preexisting dirty worktree, risk/time; not explicitly required after targeted fixes). Recommend before merge.
- Integration/staging/DB/RLS two-tenant matrix: **BLOCKED** (no authorized DB/staging credentials; no production; no writes without explicit authorization).
- Ad-unlock nested tx runtime proof and team-invite DB boundary tests: require authorized staging/runtime environment.

## Safety notes
- No RLS policies, roles, GRANT/REVOKE, migrations, or production config changed.
- No controls weakened; fixes add checks/scoping.
- F-004 marker is a server-side code guardrail, not cryptographic authorization and not a DB/RLS substitute.
