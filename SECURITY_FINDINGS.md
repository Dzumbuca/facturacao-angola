# Security Findings — Machine Facturas (updated 2026-11-06 follow-up)
Audit: `wms-v2-e2e-staging` @ `95e00366`. Static analysis + targeted local Vitest only. No production/DB/RLS application.

## Summary
| ID | Severity | Status | Area | Finding |
|---|---|---|---|---|
| F-001 | High (potential) | **MITIGATED (app-layer) / NOT DB-CONFIRMED** | WMS stock | Id-only mutations/state gaps in WMS routes lacked explicit tenant scoping/guards; hardened and covered by targeted route tests. RLS/policy/runtime still unproven. |
| F-002 | Medium (potential) | **OPEN / NOT CONFIRMED** | Ad-unlock/RLS | Nested `$transaction` + manual GUCs; runtime semantics under outer `runWithTenant` tx not confirmed. SQL retains explicit `tenant_id`. |
| F-003 | Medium (potential) | **OPEN / NOT CONFIRMED** | Team invites | Global Prisma token/platform flows with app-layer checks; DB/RLS boundary not confirmed. |
| F-004 | Medium (fragility) | **MITIGATED (code)** | RLS helpers | `tenant-db.ts` now rejects privileged admin/system execution without `PRIVILEGED_RLS` marker and forbids tenant-context admin escalation; callers updated. Not a substitute for DB/RLS proof. |
| F-005 | Low (potential) | **FIXED** | Auth/NextAuth | Removed console logging of emitted auth cookie names/lengths from `src/app/api/auth/[...nextauth]/route.ts`. |
| F-006 | Medium (potential) | **MITIGATED (app-layer, preexisting file)** | WMS movements | `src/app/api/stock/movements/[id]/route.ts` read path moved to `runWithTenant`; DELETE remains disabled/403. File was preexisting modified; change preserves tenant filter and operation block. |

## F-001 — WMS tenant scoping/state/idempotency (app-layer)
**Evidence/status:** Hardened untracked routes:
- `src/app/api/stock/adjustments/route.ts:43-54` uses `product.updateMany` with `{id,tenantId,...}` and count guards.
- `src/app/api/stock/purchase/receptions/route.ts:27-84,100-105` validates PO tenant/status, item ownership (PO item/product/lot), tenant-scoped product increment, idempotency key includes `purchaseOrderItemId`, PO marked received after item processing, maps `ALREADY_RECEIVED`/`INVALID_*`.
- `src/app/api/stock/reservations/[id]/route.ts:14-45` requires `ACTIVE` for mutating actions; tenant-scoped reservation/product `updateMany` with count guards.
- `src/app/api/stock/transfers/[id]/route.ts:23-66` enforces dispatch/receive/cancel state transitions; tenant-scoped `product.updateMany`/`stockTransferItem.updateMany`; idempotency keys include item/lot context.
**Tests (executed):** `stock/adjustments` **3/3 PASS**; `stock/transfers/[id]` **2/2 PASS**; `stock/purchase/receptions` **9/9 PASS**; `stock/reservations/[id]` **8/8 PASS**. Coverage includes unauthorized tenant (no session tenant), missing/cross-tenant lookups, invalid state/item, repeated operation, tx failure propagation, tenant-scoped where assertions, and concurrency-like `updateMany count=0` handling.

## F-002 — Ad-unlock nested transaction/GUC semantics
**Evidence:** `src/lib/ad-unlock-service.ts:49-57` opens nested tx when executor has `$transaction`; sets `app.tenant_id`, clears `user_id`, forces `app.is_admin=false`. Claim/link SQL include `tenant_id` (`113-122`,`129`). `invoice-service.ts` passes tx executor to claim and links post-commit (best-effort) — observed in prior read.
**Why open:** No authorized runtime staging DB to prove savepoint/GUC behavior under outer `runWithTenant`. `ad-unlock-core` tests still **6/6 PASS** (logic only).

## F-003 — Team invite global Prisma boundary
**Evidence:** `src/lib/team-invite-actions.ts:10,23,44,61,71-102,88` global Prisma + permission checks + token format/hash/expiry + Serializable acceptance with single-use `updateMany`. `User` RLS script (repo) restricts INSERT WITH CHECK to admin/self — potential mismatch with token-based platform invite acceptance flow; **not DB-confirmed**.

## F-004 — RLS helper trust model
**Fix evidence:** `src/lib/tenant-db.ts` (`'server-only'`, `PRIVILEGED_RLS` symbol, `assertPrivileged`, `runWithTenant` always `isAdmin:false`, `runAsAdmin/runAsSystem` require marker). Callers updated: `src/app/api/plan/payment/proof/[id]/route.ts` passes `PRIVILEGED_RLS` after platform authz; `src/lib/email-actions.ts` passes marker to all `runAsSystem` calls (preexisting modified file; diff shows marker + preserved token hardening); `src/lib/auth-prisma-adapter.ts` (untracked) passes marker.
**Tests:** `src/lib/tenant-db.test.ts` **6/6 PASS** (escalation stripped, privileged marker required, admin/system/auth contexts). `src/lib/admin-auth.test.ts` **11/11 PASS** (regression).

## F-005 — NextAuth cookie metadata logging
**Fix evidence:** `src/app/api/auth/[...nextauth]/route.ts:9-13` POST now rate-limits and returns `handlers.POST(request)` directly; cookie name/length logging removed.

## F-006 — `stock/movements/[id]`
**Fix evidence:** `src/app/api/stock/movements/[id]/route.ts` now imports `runWithTenant` (no global prisma import) and performs read as `runWithTenant(tenantId, (tx)=> tx.stockMovement.findFirst({where:{id,tenantId},select:{id,type}}))`; DELETE still returns 403. **Preexisting modified file** — diff is minimal/aligned.
