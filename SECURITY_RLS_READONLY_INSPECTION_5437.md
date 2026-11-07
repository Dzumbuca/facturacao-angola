# SECURITY RLS READ-ONLY INSPECTION — CONFIRMED EVIDENCE (5437/mf_rls_staging)
Date: 2026-11-07 (read-only inspection executed)
Authorized target: `127.0.0.1:5437/mf_rls_staging` (Docker container `machine-stock-test-pg`, `postgres:17`, host port `5437->5432`, container status `running`).
DB identity confirmed: `current_database()=mf_rls_staging`, inspection session `current_user=postgres` (superuser/bypassrls — inspection only).
Method: `docker exec -i machine-stock-test-pg psql -U postgres -d mf_rls_staging -v ON_ERROR_STOP=1 -X -q -P pager=off -1 --set=default_transaction_read_only=on` with read-only SQL (`SECURITY_RLS_READONLY_INSPECTION_5437.sql` prechecked: no DDL/DML keywords). No app/DB changes.

## Counts (confirmed)
| Metric | Value |
|---|---:|
| Public base tables inspected (`pg_class` relkind `r`, schema `public`) | **51** |
| Tables with RLS enabled | **47** |
| Tables with RLS disabled | **4** |
| Tables with FORCE RLS | **0** |
| `pg_policies` rows (public) | **47** |
| Tables with RLS enabled and no policy | **0** |
| Roles inspected (`pg_roles`) | **27** |

## 4 tables without RLS (confirmed)
| Table | RLS | FORCE | Owner |
|---|---:|---:|---|
| `Account` | false | false | postgres |
| `EmailActionToken` | false | false | postgres |
| `Session` | false | false | postgres |
| `VerificationToken` | false | false | postgres |

## Policy evidence (confirmed)
- All 47 policies: `cmd=ALL`, `roles={public}`, 1 policy per covered table.
- GUCs referenced in live policies: **`app.is_admin`, `app.tenant_id`, `app.user_id`**. `app.current_tenant_id` references in `pg_policies`: **0**.
- Patterns observed:
  - Tenant isolation (`rls_tenant_isolation`): admin GUC true OR `app.tenant_id = "tenantId"` in USING and WITH CHECK.
  - `AdUnlock` (`rls_adunlock_tenant`): admin OR `app.tenant_id = tenant_id` (snake_case column).
  - `InvoiceItem` (`rls_invoiceitem_via_invoice`): admin OR EXISTS parent `Invoice` with matching tenant.
  - `Tenant` (`rls_tenant_self_or_admin`): admin OR `app.tenant_id = id`.
  - `EmailDelivery` (`rls_emaildelivery_tenant_or_global`): admin OR `"tenantId" IS NULL` OR tenant match.
  - `User` (`rls_user_self_tenant_admin`): USING allows admin OR self `app.user_id=id` OR same `app.tenant_id` (non-empty, `tenantId` not null). WITH CHECK allows admin OR self `app.user_id=id` only.
  - Admin-only tables (`rls_admin_only`): `app.is_admin='true'` only — `AdminAuditLog`, `EmailCampaign`, `EmailCampaignRecipient`, `EmailRequestLimit`, `MarketingPreference`, `PlanApplication`, `PlatformApplication`, `PlatformConfig`, `PlatformTeamInvite`, `SubscriptionPlan`.

## Roles / BYPASSRLS / login (confirmed, metadata)
| Role | superuser | bypassrls | login | notes |
|---|---:|---:|---:|---|
| postgres | true | true | true | inspection session; bypasses RLS |
| mf_app_login | false | false | true | app-like login role |
| mf_admin_login | false | false | true | admin-like login role |
| mf_auth_login | false | false | true | auth-scoped login role |
| mf_migration | false | false | false | migration role |
| mf_app_nobypass | false | false | false | no login |
| anon/authenticated/service_role/app_user/mf_* executors | false | false | mostly false | see grants/roles in evidence file |

## Table grants (confirmed, selected)
- `mf_app_login`: 204 grant rows, `DELETE,INSERT,SELECT,UPDATE` across public tables (includes all 51 public tables, including 4 no-RLS and admin-only tables).
- `mf_app_nobypass`: 204 rows, `DELETE,INSERT,SELECT,UPDATE`.
- `mf_admin_login`: 204 rows, `DELETE,INSERT,SELECT,UPDATE`.
- `mf_auth_login`: 24 rows, `DELETE,INSERT,SELECT,UPDATE` (focused evidence shows grants on `Account, EmailActionToken, EmailRequestLimit, Session, User, VerificationToken`).
- `mf_migration`: 357 rows, `DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE`.
- 4 no-RLS tables grants (focused): `mf_app_login/mf_admin_login/mf_auth_login` have `DELETE,INSERT,SELECT,UPDATE` on `Account,Session,VerificationToken,EmailActionToken`. `anon/authenticated/service_role` not present in that focused grant set.

## Confirmed risks / divergences
1. **No FORCE RLS** on any public table (`force_rls=0` for all 51). Table owners can bypass RLS when not forced; all owners observed as `postgres`. Non-owner app roles are still subject to RLS.
2. **4 auth/infra tables without RLS** (`Account,Session,VerificationToken,EmailActionToken`): access control depends on SQL grants/app logic, not row policies. App/login roles listed above have DML grants on them.
3. **Broad grants for `mf_app_login`/`mf_app_nobypass`/`mf_admin_login`** (DML on all public tables). RLS policies are the primary boundary for 47 tables; correctness depends on `app.tenant_id/app.user_id/app.is_admin` being set by trusted server paths.
4. **Policies are coarse `FOR ALL TO PUBLIC`** with GUC/admin bypass; no separate SELECT/INSERT/UPDATE/DELETE policies. This is simpler but requires careful GUC discipline.
5. **`User` WITH CHECK is admin/self only**: tenant-scoped inserts/updates relying on tenant match in USING are not allowed by WITH CHECK. Relevant to flows like team-invite acceptance/user creation/role updates — **DB/runtime compatibility remains to be validated in authorized staging tests** (F-003).
6. **`postgres` is superuser+bypassrls** (expected for admin container role) — application must not use this role.
7. **Prior doc discrepancy resolved:** live policies do **not** use `app.current_tenant_id`; they use `app.tenant_id/app.user_id/app.is_admin`.

## Still NOT confirmed (requires authorized runtime/write tests or app config evidence)
- Which DB role/connection string the application actually uses in staging/production.
- Whether server paths always set correct GUCs before privileged queries (static audit improved, but not full runtime proof).
- Two-tenant isolation behavior over real HTTP/app flows and edge cases (F-001 app-layer mitigated; DB policies exist but runtime matrix not executed).
- F-002 ad-unlock nested transaction/GUC semantics.
- F-003 team invite DB/RLS compatibility for `User`/global tables.
- RLS effectiveness for id-only mutations beyond app-layer guards.

## Evidence artifacts
- `tmp/rls-readonly-5437-output-utf8.txt` (full read-only inspection output)
- `tmp/rls-readonly-summary2.txt`
- `tmp/rls-readonly-grants.txt`
- `tmp/rls-readonly-focused.txt`
- `SECURITY_RLS_READONLY_INSPECTION_5437.sql` (read-only query bundle)
