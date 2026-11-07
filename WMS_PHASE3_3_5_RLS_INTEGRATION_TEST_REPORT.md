# WMS Phase 3.3.5 — RLS Integration Test Report

## Environment
- Container: machine-wms-staging (postgres:18)
- Test DB: wms_rls_integration_test (created from verified backup wms_staging_backup_20261104_000807.dump; dropped after tests)
- Role used for tests: app_user (no BYPASSRLS, no SUPERUSER)
- Script D applied only to test DB; original staging untouched.

## Results
| # | Test | Role | Tenant | Expected | Obtained | Result |
|---|------|------|--------|----------|----------|--------|
| 1 | No context → Product count | app_user | none | 0 rows | 0 | PASS |
| 2 | Tenant A reads own Product | app_user | A | 1 | 1 | PASS |
| 3 | Tenant B reads own Product | app_user | B | 1 | 1 | PASS |
| 4 | Common user reads EmailCampaign | app_user | A (isAdmin=false) | 0 | 0 | PASS |
| 5 | set_config(true) no leak across tx | app_user | A then none | empty | empty | PASS |
| 6 | Rollback on error | app_user | A | 0 remaining | 0 | PASS |
| 7 | BYPASSRLS check | app_user | — | false | false (no attr) | PASS |

## Evidence
- Tenant isolation: each tenant sees only its own single Product row.
- Admin tables fail-closed for common user.
- Transaction-local context (set_config ..., true) does not leak.
- Rollback verified: division-by-zero aborted transaction; 0 rows remained.

## Cleanup
- wms_rls_integration_test dropped; temp files removed. Staging original intact; backup retained.

## Verdict
APROVADO para aplicação do Script D no staging original.
