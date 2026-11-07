# WMS Phase 3.3.3 — RLS Integration Audit Report

## 1. Calls Found (14 total)
| File | Line | Endpoint/Service | tenantId origin | userId origin | admin origin | tx-only? |
|------|------|------------------|-----------------|---------------|--------------|----------|
| src/app/api/stock/route.ts | 25 | GET /api/stock | session tenant | session user (fixed) | false | yes |
| src/app/api/stock/movements/route.ts | 13 | GET /api/stock/movements | session tenant | session user (fixed) | false | yes |
| src/app/api/stock/movements/route.ts | 45 | POST /api/stock/movements | session tenant | session user | false | yes |
| src/app/api/stock/transfer/route.ts | 25 | POST /api/stock/transfer | session tenant | session user | false | yes |
| src/app/api/stock/warehouses/route.ts | 12 | GET /api/stock/warehouses | session tenant | session user | false | yes |
| src/app/api/stock/warehouses/route.ts | 27 | POST /api/stock/warehouses | session tenant | session user | false | yes |
| src/app/api/stock/warehouses/[id]/route.ts | 19 | PATCH warehouse | getTenantWriteAccess | not available | false | yes |
| src/app/api/stock/warehouses/[id]/route.ts | 53 | DELETE warehouse | getTenantWriteAccess | not available | false | yes |
| src/lib/invoice-service.ts | 21 | issue invoice | tenantId param | none | false | yes |
| src/lib/invoice-service.ts | 286 | issueCreditNote | authenticatedTenantId (required) | none | false | yes |
| src/lib/stock-service.ts | 116 | registerStockEntry | tenantId param | contextUserId/createdByUserId | false | yes |
| src/lib/stock-service.ts | 149 | getLowStockAlerts | tenantId param | none | false | yes |
| src/lib/stock-service.ts | 174 | getStockValuationReport | tenantId param | none | false | yes |
| src/lib/stock-service.ts | 212 | getStockRotationReport | tenantId param | none | false | yes |

## 2. Completions
- runWithTenant now sets app.tenant_id, app.user_id, app.is_admin (transaction-local).
- registerStockEntry accepts contextUserId.
- issueCreditNote now requires tenantId (throws TENANT_REQUIRED); no longer passes ''.
- warehouses/[id] routes rely on getTenantWriteAccess (tenant-scoped); userId not available from that access object — admin policies fail-closed (acceptable; these tables are tenant-scoped, not admin-scoped).

## 3. Security
- app.is_admin only set from explicit context, default false; no client can set it.
- Company admin vs platform admin: no isAdmin flag exists on session; default false. Admin-only tables (EmailCampaign, PlatformTeamInvite) remain inaccessible to app role (fail-closed) unless explicitly granted.
- Missing context → runWithTenant throws on empty tenantId; RLS blocks rows when config vars unset.
- Context is transaction-local (set_config ..., true), not shared across connections.
- All protected queries occur inside tx; no queries outside runWithTenant for protected tables.
- app_user role: verify BYPASSRLS=false (to be confirmed in DB; not in code).

## 4. Tests
- Existing suite: 249/249 pass.
- No new concurrency/RLS integration tests added in this pass (Script D not applied).

## 5. Validation
- prisma validate: OK.
- prisma generate: OK (implied).
- tsc --noEmit: OK.
- vitest run: 48 files, 249/249 pass.

## 6. Risks Pending
- issueCreditNote tenantId is caller-supplied param (not session-derived); callers must pass authenticated tenantId.
- warehouses/[id] routes have no userId context (admin policies fail-closed; acceptable for tenant tables).
- BYPASSRLS status of app_user not verified in code (DB check needed).
- Script D not yet applied.

## Verdict
APROVADO PARA APLICAÇÃO DO SCRIPT D.
(Subject to confirming app_user lacks BYPASSRLS in DB and applying Script D in a future authorized step.)
