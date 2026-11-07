# RLS_FINANCIAL_WMS_REPORT.md
**Status:** **PARTIAL / NOT EXECUTED (functional HTTP cycles).**

## Positive evidence (RLS/data/service-level signals)
| Area | Result | Evidence |
|---|---|---|
| Tenant financial/WMS table RLS isolation (DB) | **PASS** subset | `rls-staging-two-tenant-test.cjs` 19/19, `rls-priority-tables-test.cjs` 60/60 — invoices, payments, stock movements, warehouses, business docs, invoice items, WMS/priority tables, no-context zero rows, cross-tenant read/write blocked, WITH CHECK. |
| Customer/Product/Warehouse HTTP A/B isolation | **PASS** | `http-isolation-ab-extended.json` (23/23): own-only reads, cross-tenant ID GET/PATCH blocked/no leak. |
| Payment/invoice service code uses tenant-scoped execution | **PARTIAL (code)** | `src/lib/payment-service.ts` uses `runWithTenant`; `api/invoices/[id]/payments` uses tenant read/write access + tenant context; full HTTP cycle not run. |
| Invoice PDF generation route guards/quota/tenant access present | **PARTIAL (code)** | `api/invoices/generate-pdf/route.ts` uses tenant write access/quota/issue path; functional PDF+payment state not executed. |
| Stock/WMS routes generally carry tenant context/auth signals | **PARTIAL (heuristic)** | route audit; HTTP limited to warehouses/stock reads and cross-ID checks. |

## Not Executed (required)
- HTTP, independent A/B sessions: customer/product CRUD where applicable; draft invoice create/issue/query; PDF generation/access protection; payment create, partial/total, history, balances, receivables, financial reports; cancel/reversal if supported.
- Cross-tenant access attempts for invoices/payments/documents/PDFs; ID manipulation; unauth/authz-negative for each financial endpoint.
- DB state verification after each mutation beyond existing DB scripts.
- WMS full flows: warehouses/products/stock CRUD beyond proven reads; stock in/out/adjustments; inter-warehouse transfers; purchase orders/goods reception; movements/reversals/idempotency/history/reports; tenant isolation per operation; composite FK cross-tenant rejection in runtime flows.
- Synthetic fixture completeness for full financial/WMS cycles (5437 schema drift/routing required careful setup).

## Risks
- Financial correctness under RLS (totals/balances after partial/total payments) **NOT PROVEN** by HTTP.
- WMS approved architecture intentionally preserved; lack of HTTP proof is a readiness gap, not evidence of failure.
- Tables named `Receipt`/`InvoicePayment` not found by direct relation probe in 5437 (`PaymentReceipt` exists); endpoint/model mapping must be respected before testing.

**Conclusion:** Financial/WMS **NOT PROVEN** end-to-end. No fake-green claims made.
