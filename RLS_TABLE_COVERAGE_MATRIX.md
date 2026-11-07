# RLS_TABLE_COVERAGE_MATRIX

**Scope:** `mf_rls_staging` @ `127.0.0.1:5437` (container `machine-stock-test-pg`, PG17). Read-only audit + additive 5437-only setup executed in this phase. **Not production.**

## Evidence
- Prisma models: **51** (all present in DB; `RLS_TABLE_COVERAGE_MATRIX.json` regenerated, `dbOnly=0`).
- Public tables with RLS status (5437): 51 rows total.
- Policies: **47 relations have RLS enabled and 1 policy each** (`pg_policies` count). No RLS-enabled table has zero policies.
- Regressions: `scripts/rls-staging-two-tenant-test.cjs` **19/19 passed** (EXIT 0); `scripts/rls-priority-tables-test.cjs` **60/60 passed** (expanded priority tables).

## Table Matrix

| Table | RLS | Policy/intent | tenant isolation | Evidence status |
|---|---:|---|---|---|
| Account | OFF (prototype) | none; NextAuth adapter dependency | N/A (auth) | Schema/audit only; HTTP/E2E not run |
| Session | OFF (prototype) | none; NextAuth adapter dependency | N/A (auth) | Schema/audit only |
| VerificationToken | OFF (prototype) | none; NextAuth adapter dependency | N/A (auth) | Schema/audit only |
| EmailActionToken | OFF (prototype) | none; auth/reset/verify dependency | N/A (auth) | Schema/audit only |
| User | ON | `rls_user_self_tenant_admin` USING+WITH CHECK (self/same-tenant/admin) | partial/special (`tenantId` nullable) | Policy verified; SQL isolation for business tables exercised; full auth lifecycle not E2E |
| AdUnlock | ON | `rls_adunlock_tenant` USING+WITH CHECK (`tenant_id` snake_case) | yes | **60/60 suite**: own read, cross read/write blocked, missing context zero, admin context read, own insert hidden |
| AdminAuditLog | ON | `rls_admin_only` | global/admin | Baseline: normal user count 0; admin context read OK |
| BusinessDocument* (5 tables) | ON | `rls_tenant_isolation` | yes | Baseline cross-read blocked (sample); expanded CRUD not fully scripted for all 5 |
| CompanyBankAccount, CompanyLogo | ON | `rls_tenant_isolation` | yes | **60/60 suite** exercised |
| Customer, Product, Warehouse, Invoice, InvoiceDraft, Payment, PaymentEvent, PaymentReceipt, StockMovement | ON | `rls_tenant_isolation` | yes | Baseline + selected routes/services use `runWithTenant`/tenant guards (code audit); full HTTP/E2E not run |
| InvoiceItem | ON | `rls_invoiceitem_via_invoice` (parent Invoice) | indirect | Baseline cross-read blocked, own read OK |
| EmailCampaign, EmailCampaignRecipient, EmailDelivery, MarketingPreference | ON | tenant isolation/admin/global patterns per policy SQL | mixed (`EmailDelivery` allows `tenantId IS NULL` global rows) | **EmailDelivery** in 60/60 suite; others policy-present, not fully CRUD-tested |
| EmailRequestLimit | ON | `rls_admin_only` | global/admin | Policy present; not CRUD-tested |
| PlanPayment, TenantApplication, TenantSubscription | ON | `rls_tenant_isolation` | yes | **60/60 suite** exercised |
| Supplier, ProductWarehouseStock, StockLot, StockAdjustment(+Item), StockReservation, StockTransfer(+Item/Reception/ReceptionItem), PurchaseOrder(+Item/Reception/ReceptionItem) | ON | `rls_tenant_isolation` USING+WITH CHECK | yes | **60/60 suite** exercised (own/cross/missing/admin/insert as applicable) |
| PlatformApplication, SubscriptionPlan, PlanApplication, PlatformConfig, PlatformTeamInvite, Tenant | ON | admin/global isolation as designed in staging SQL | global/admin/special | Policy present; partial read/admin-context evidence only; admin executor/runtime not fully proven |

## Gaps / Not Fully Proven
- Full `SELECT/INSERT/UPDATE/DELETE` evidence for **every** table not individually listed in 60/60 suite (policy/structure present).
- Indirect/FK access patterns and all route/service execution contexts (Prisma global singleton still used in auth/admin/cron/some flows).
- 5437 schema drift vs current Prisma schema (missing newer Product/StockMovement columns from full diff) limits Prisma-model-level functional tests.
- `_prisma_migrations` relation absent in 5437 while Prisma migrate status reported up to date — anomaly unresolved.
- HTTP/E2E and Supabase/PgBouncer transaction-pooling compatibility not validated.
