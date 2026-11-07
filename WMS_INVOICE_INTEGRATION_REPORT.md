# WMS Invoice Integration Report

## Findings
- issueCreditNote exists in src/lib/invoice-service.ts; no callers in src (grep confirmed).
- tenantId now required (throws TENANT_REQUIRED); whereClause always filters by tenantId.
- Stock deduction on invoice issuance not wired to a WMS movement in the audited code (no caller of registerStockEntry from invoice flow found).

## Status
Integration point not implemented. No fiscal rules invented. Pendência documented: define business rule for stock deduction on invoice issuance and credit-note stock restoration before implementation.

## Verdict
NÃO APROVADO — integration incomplete; requires business decision.
