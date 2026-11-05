# RLS_FINANCIAL_WMS_REPORT

**Status:** **PARTIAL.** Strong DB-level isolation evidence on 5437; application financial/WMS behavior under NOBYPASSRLS HTTP runtime remains unproven.

## DB Isolation Evidence (5437, NOBYPASSRLS, real)
- Baseline **19/19 PASS**: invoices, payments, stock movements, warehouses, business documents, invoice items (via Invoice), admin audit log behavior, missing context.
- Expanded **60/60 PASS**: `CompanyBankAccount`, `CompanyLogo`, `PlanPayment`, `Supplier`, `ProductWarehouseStock`, `StockLot`, `StockAdjustment/Item`, `StockReservation`, `StockTransfer/Item/Reception/ReceptionItem`, `PurchaseOrder/Item/Reception/ReceptionItem`, `TenantApplication/Subscription`, `EmailDelivery`, `AdUnlock` (own/cross read/write, WITH CHECK/anti-spoof samples, missing context, admin sampled, own insert isolation).
- Executor integration **5/5 PASS** (supports auth/admin/infra context correctness).

## Code Audit / Fixes Relevant to Financial+WMS
- Tenant-scoped financial/WMS services/routes largely use `getTenant*Access`/`runWithTenant` patterns (prior audit preserved): invoice service/drafts, payment service/transition route, stock service/routes, reports/SAFT/business docs/receipt/ad unlock paths sampled.
- This phase added no WMS/financial feature changes; focused on RLS executor plumbing and auth/admin/cron context. `USING`/`WITH CHECK` policies preserved.
- `npx tsc --noEmit` PASS. `vitest src/app/api/stock/route.test.ts` **4/4 PASS**.

## Risks / Not Proven
- **HTTP E2E NOT EXECUTED** against 5437+NOBYPASSRLS: draft->issue, numbering/idempotency/PDF, receipt/payment transitions, credit-note/stock return behaviors through routes, WMS adjustments/transfers/receptions/reservations, admin/platform payment proof in runtime.
- 5437 schema drift vs current Prisma schema (additive subset only) may affect full Prisma-model runtime tests.
- Prior 5436 stress (20/50/100/200, 0 failures) was on WMS staging without MF RLS role/policy model applied to that runtime.
- 5436 `PROD-A-SYNTH` reconciliation mismatch remains pending explicit decision; no `--apply`.

## Conclusion
**DB isolation: PASS for covered tables/scenarios. App runtime financial/WMS correctness under RLS: NOT PROVEN.**
