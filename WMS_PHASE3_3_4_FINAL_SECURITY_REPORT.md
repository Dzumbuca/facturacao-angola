# WMS Phase 3.3.4 — Final Security Report (pre-Script D)

## 1. Role / BYPASSRLS verification (staging docker)
- Effective app role used by Prisma in local staging: app_user (per local docker staging; .env.staging points to Supabase staging using postgres role).
- app_user attributes: no BYPASSRLS, no SUPERUSER (confirmed via \du). staging_admin is Superuser + Bypass RLS.
- RLS enabled and FORCED on Product, StockMovement, Warehouse, Invoice, Tenant (relrowsecurity=t, relforcerowsecurity=t).
- app_user cannot bypass RLS (attribute absent). staging_admin bypasses (expected, admin-only).

## 2. issueCreditNote callers
- Only definition at src/lib/invoice-service.ts:275; no callers in src. tenantId param required now (throws TENANT_REQUIRED if missing). No client-controlled value currently; future callers must pass authenticated tenantId.

## 3. Operations without userId
- warehouses/[id] PATCH/DELETE: use getTenantWriteAccess (tenant-scoped). No userId available; admin policies fail-closed (acceptable — these are tenant tables, not admin tables).
- getLowStockAlerts / getStockValuationReport / getStockRotationReport: read-only tenant reports; no user identity required by RLS policies (tenant-scoped). No artificial admin grants introduced.

## 4. RLS isolation tests
- Not executed against live DB in this pass (Script D not applied; constraints forbid data changes). Existing vitest suite (249/249) covers unit-level runWithTenant mocking only.

## 5. 14 runWithTenant calls review
- All tenantId validated server-side (session or getTenantWriteAccess). userId passed where session available; isAdmin always false (no platform admin flag on session). All protected queries inside tx. No service_role/BYPASSRLS usage in app code.

## 6. Validation
- prisma validate: OK
- prisma generate: OK
- tsc --noEmit: OK
- vitest run: 48 files, 249/249 pass
- npm run build: OK

## Verdict
NÃO APROVADO para aplicação do Script D — testes reais de isolamento RLS (tenant A vs B, ausência de contexto, concorrência, rollback) não foram efetivamente executados contra base isolada. Aprovação condicionada à execução desses testes.
