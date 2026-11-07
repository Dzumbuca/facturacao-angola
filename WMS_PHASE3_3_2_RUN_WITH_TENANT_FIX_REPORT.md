# WMS Phase 3.3.2 — runWithTenant Fix Report

## Summary
Fixed `runWithTenant` (src/lib/tenant-db.ts) to set all three RLS context variables
(`app.tenant_id`, `app.user_id`, `app.is_admin`) inside the transaction, using
`set_config(..., true)` (transaction-local). Signature extended with optional
`context: { userId?, isAdmin? }`, defaulting isAdmin=false and userId=null
(fail-closed for admin-only policies).

## Changes
- src/lib/tenant-db.ts — new TenantContext type; sets all three config vars.
- src/app/api/stock/route.ts — passes `{ userId, isAdmin: false }`.
- src/app/api/stock/movements/route.ts — passes context in GET and POST.
- src/app/api/stock/transfer/route.ts — passes context.
- src/app/api/stock/warehouses/route.ts — passes context in GET and POST.
- src/app/api/stock/route.test.ts — added getSessionUserId mock + updated assertion.

## Validation
- prisma validate: schema valid.
- tsc --noEmit: pass.
- vitest run: 48 files, 249/249 tests pass.
