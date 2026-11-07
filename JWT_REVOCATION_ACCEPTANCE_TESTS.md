# JWT_REVOCATION_ACCEPTANCE_TESTS
**Date:** 2026-11-05 | **Design only — tests NOT executed as implementation proof.**

## Required automated/controlled tests (post-implementation)
| ID | Scenario | Expected |
|---|---|---|
| T1 | Login valid user | Session/API access authorized |
| T2 | Logout current device; reuse pre-logout JWT copy | 401/403 or invalid session; no data/mutation |
| T3 | Copied JWT on `/api/produtos`, `/api/customers`, `/api/stock/*`, `/api/reports/export`, `/api/invoices/generate-saft` | Rejected |
| T4 | Copied JWT `POST /api/customers` and representative mutations | Rejected; **DB unchanged** |
| T5 | Copied JWT `/api/session/refresh` | Rejected; no refreshed cookie/token |
| T6 | Copied admin JWT on admin/sensitive routes | Rejected before privileged data/action |
| T7 | Logout device A; device B remains valid | A rejected, B allowed until expiry/revocation |
| T8 | Global logout / revoke all | All user JWTs rejected |
| T9 | Password reset/change | Previous JWTs rejected |
| T10 | Account suspended | JWT rejected |
| T11 | Role/tenant changed | Old permissions/context not accepted for sensitive ops |
| T12 | Expired JWT / missing required `jti` / unknown `jti` | Rejected |
| T13 | Revocation DB unavailable/timeout | **Fail closed** for protected paths |
| T14 | Multi-tenant A/B stale + active combinations | No cross-tenant read/write/revocation |
| T15 | Logout + refresh race | No valid token survives race; no new token from revoked source |
| T16 | Server actions / `runAsSystem` user-session boundary | Revocation checked before privileged path |
| T17 | Google/Credentials regression (when available) | Login/logout/revocation behavior preserved; OAuth marked proven/not proven |

## Evidence requirements
Record HTTP status/body class, session state, DB before/after for mutations, synthetic tenant/user ids, race timing. Never store raw JWT/cookies/secrets/passwords. Run on authorized staging (5437 first) with NOBYPASSRLS runtime role and preserved fixtures.
