# WMS Invoice Integration Final Plan

## Integration points identified
- issueInvoice (src/lib/invoice-service.ts ~line 21): wraps in runWithTenant(tenantId, tx). Stock deduction should occur here after invoice persistence, inside the same transaction.
- issueCreditNote (line 275): requires authenticated tenantId (now enforced). Stock restoration should occur here, idempotently.
- registerStockEntry (src/lib/stock-service.ts): available for entry movements; accepts contextUserId.

## Proposed (NOT activated — requires business decision)
Option A: Automatic stock deduction on invoice issuance (OUT movement per item) inside the invoice transaction.
Option B: Manual stock adjustment by operator after invoicing (no auto-deduction).
Option C: Hybrid — auto-deduction only for products with stock control enabled.

## Requirements before activation
- Business rule approved by product owner.
- Idempotency guard (invoiceId-based idempotency key) to prevent duplicate movements.
- Rollback consistency (if invoice issuance fails, no stock movement persists).
- AGT fiscal compliance review.

## Current state
No automatic stock movements activated. issueCreditNote has no callers. registerStockEntry not invoked from invoice flow.

## Dependencies on product owner
- Approve deduction rule (A/B/C).
- Approve credit-note stock restoration policy.
- Approve partial cancellation handling.
