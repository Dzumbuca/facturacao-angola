# RLS_SCHEMA_COMPATIBILITY_REPORT.md
**Scope:** `mf_rls_staging` @ `127.0.0.1:5437` only (PostgreSQL 17, role target `mf_app_login` NOBYPASSRLS). **No migrations applied. No drops/truncates/resets.**

## Method
- Existing 5437 RLS coverage evidence: `RLS_TABLE_COVERAGE_MATRIX.json/.md` (51 Prisma models present, `dbOnly=0`, 47 relations RLS ON with 1 policy each, no RLS-enabled table with 0 policies).
- Live spot check (`tmp/schema-rls-spotcheck.cjs`): sampled key Prisma/business/WMS/auth tables exist with expected RLS/policy posture; anomalies `[]`.
- Prisma schema source: `prisma/schema.prisma` (51 models). Residual drift not exhaustively re-diffed across all columns/types/indexes/FKs/constraints in this pass.

## Compatibility Matrix (summary)
| Area | Result | Evidence | Notes |
|---|---|---|---|
| Prisma models present in 5437 | **PASS (51/51, prior evidence)** | `RLS_TABLE_COVERAGE_MATRIX.*` | `dbOnly=0`. |
| Tenant-scoped tables RLS/policies | **PASS (47 relations, 1 policy each, prior evidence)** | coverage matrix + live spot check | USING/WITH CHECK patterns previously validated by SQL isolation tests. |
| Auth adapter tables RLS posture | **AT RISK (prototype)** | coverage matrix, spot check | `Account, Session, VerificationToken, EmailActionToken` RLS OFF on 5437 by prototype; PrismaAdapter uses global Prisma. |
| `User`/`Tenant` RLS | **PASS (live spot)** | `tmp/check-tenant-user-policies.cjs` | `Tenant` self/admin policy; `User` self/tenant/admin USING with restricted WITH CHECK. Required `admin-auth` fix to read tenant status in explicit tenant context. |
| Sampled business/WMS tables exist | **PASS (spot)** | `tmp/schema-rls-spotcheck.cjs` | Includes `Customer,Product,Invoice,Payment,PlanPayment,PaymentReceipt,Warehouse,ProductWarehouseStock,StockMovement,Stock*...` |
| Tables absent by naming in 5437 | **NOTED** | `tmp/check-financial-tables.cjs` | `CompanyProfile, InvoicePayment, Receipt, AuditLog, AdminAuditLog, PlatformMember` returned MISSING by relation probe; may be named differently or modeled differently — **NOT PROVEN** missing from Prisma/app semantics without full mapping. Do not infer destructive action. |
| Column/type/index/FK/constraint full diff (all 51) | **NOT PROVEN** | partial | `tmp/rls-5437-schema-compat.cjs` applied additive compat for sampled `Product/StockMovement` only (local, uncommitted). Full 51-model column/type/index/FK audit **NOT EXECUTED**. |
| RLS OFF tables beyond adapter prototype | **NOT PROVEN exhaustively** | spot/prior | Prior coverage reported 4 adapter tables RLS OFF; full live enumeration across all relations not repeated this pass. |

## Additive-safe candidates (proposed only; NOT executed)
- Complete per-model diff: Prisma vs 5437 columns/types/nullability/defaults/indexes/unique/composite FKs/check constraints/RLS/policies.
- Reconcile any missing Prisma tables/columns with **additive** SQL only after compatibility review and approved migration window.
- Keep adapter-table RLS strategy explicit (OFF prototype vs executor/policy design) before production; do not change policies without impact tests.

## Risks
- Residual schema drift can cause runtime Prisma errors not caught by current probes (seen historically on Product/StockMovement before compat patch).
- 5436 has divergent policies/WMS state (untouched) — **do not assume 5437 SQL applies to 5436/production**.

**Conclusion:** Compatibility **PARTIAL/NOT PROVEN**. No destructive or automatic schema changes made.
