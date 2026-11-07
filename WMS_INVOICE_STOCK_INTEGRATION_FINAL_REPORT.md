# WMS Invoice Stock Integration Final Report

## Changes
- issueInvoice: already calls decrementStockForInvoice inside transaction (idempotency key invoice-{invoiceId}-{productId}). Drafts do not trigger (issuance only).
- issueCreditNote: removed automatic stock restoration per approved rule. Credit note is fiscal/financial; stock restoration only on physical return (separate entry movement).

## Verification
- tsc OK; vitest 249/249 pass.

## Pending
- Physical return entry movement endpoint not yet implemented (separate feature).
