# Security Remaining Risks — Machine Facturas (updated 2026-11-06 follow-up)
After targeted fixes/tests: WMS app-layer hardening improved; end-to-end tenant/RLS safety still **not proven**.

## Status summary
| ID | State | Risk |
|---|---|---|
| F-001 | MITIGATED (app-layer) / NOT DB-CONFIRMED | RLS/policy/runtime for id-only mutations still unproven. |
| F-002 | OPEN / NOT CONFIRMED / BLOCKED for runtime proof | Ad-unlock nested tx + manual GUC semantics. |
| F-003 | OPEN / NOT CONFIRMED | Team-invite global Prisma + `User` RLS INSERT/WITH CHECK compatibility (repo SQL shows admin/self check) not DB-confirmed. |
| F-004 | MITIGATED (code) | Server-side marker guard added; not a DB/RLS substitute and not cryptographic auth. |
| F-005 | FIXED | Auth cookie metadata logging removed. |
| F-006 | MITIGATED (app-layer) | Movements read aligned to `runWithTenant`; DELETE still blocked. |
| RLS matrix | BLOCKED | 47-table/FORCE/GRANT/role/live policy validation and 2-tenant runtime matrix require authorized read-only staging/DB access. |
| Regression | PARTIAL | Targeted Vitest suites passed; full TS/ESLint/build/integration/staging not executed. |

## Required next steps (authorized)
1. **RLS DB validation (read-only, non-production target):** confirm live policies/enabled/FORCE, `app.tenant_id/app.user_id/app.is_admin` behavior, role grants, BYPASSRLS/superuser for app role, and reconcile `app.current_tenant_id` vs `app.tenant_id` mismatch in `prisma/rls-machine-stock.sql`.
2. **Two-tenant staging matrix (authorized):** SELECT/INSERT/UPDATE/DELETE/relations and key flows (stock, reservations, transfers, receptions, invoicing, team invites, ad-unlock) for tenant A/B isolation.
3. **F-002 runtime proof:** integration test in authorized staging/lab covering `claimUnlockForEmission`/`linkUnlockToInvoice` inside outer `runWithTenant` tx; validate no privilege/context leak; adjust only with evidence.
4. **F-003 boundary proof:** validate token acceptance/creation flows against actual `PlatformTeamInvite`/`User`/`AdminAuditLog` RLS policies and role grants; fix only if mismatch proven.
5. **Full regression:** run `tsc`/ESLint/build and relevant integration suites in a controlled environment; separate preexisting failures from audit changes.
6. **Commit hygiene:** ~411 preexisting modified/untracked files remain; do **not** create a blanket commit. Create a selective commit only if audit-owned files can be isolated safely.

## Explicit no-go reasons
- No live DB/RLS/role/grant proof in target environment.
- No two-tenant runtime isolation proof.
- F-002/F-003 runtime/policy boundaries unconfirmed.
- Full project regression not executed.

## 5437 read-only inspection attempt (authorized 2026-11-07, BLOCKED)
- Authorized target: `127.0.0.1:5437/mf_rls_staging` (read-only).
- Result: **BLOCKED before connection**. No env/config resolved to the exact authorized target (checked env metadata only; .env.staging points to Supabase pooler 6543/postgres; local envs point to 5436/wms_staging; compose 5437 maps to machine_stock_test). No SQL executed, no DB accessed, no credentials exposed.
- Artifacts: SECURITY_RLS_READONLY_INSPECTION_5437.sql (read-only bundle), SECURITY_RLS_READONLY_INSPECTION_BLOCKED.md.
- Still unknown live: table RLS/FORCE, owners, BYPASSRLS/superuser, effective grants/REVOKE, live policies/USING/WITH CHECK, GUC enforcement, doc-vs-DB divergences.

## 5437 read-only inspection (2026-11-07, COMPLETED — authorized)
- Target confirmed: container machine-stock-test-pg (postgres:17, running, 5437->5432), DB mf_rls_staging, inspection via postgres in READ ONLY transaction. No DDL/DML/writes.
- Confirmed: 51 public tables; 47 RLS enabled / 4 disabled (Account,EmailActionToken,Session,VerificationToken); **0 FORCE RLS**; 47 policies total, all FOR ALL TO PUBLIC, 0 RLS-enabled tables without policy; GUCs pp.is_admin, app.tenant_id, app.user_id only (no pp.current_tenant_id).
- Confirmed grants (table-level): mf_app_login/mf_admin_login/mf_app_nobypass have DELETE/INSERT/SELECT/UPDATE on all 51 public tables; mf_auth_login scoped (24 rows); mf_migration broad. 4 no-RLS tables have DML grants for app/admin/auth login roles.
- Confirmed risk posture: RLS depends on trusted GUC setting; no FORCE RLS; 4 auth/infra tables rely on grants/app logic; User WITH CHECK admin/self only (F-003 compatibility still runtime-unproven).
- Still blocked/not proven: actual app DB role in each env, 2-tenant runtime isolation matrix, F-002 nested tx/GUC runtime, F-003 DB/RLS runtime compatibility, full build/integration regression.
- Evidence: SECURITY_RLS_READONLY_INSPECTION_5437.md, 	mp/rls-readonly-*-utf8/summary2/grants/focused.txt.
## 2026-11-07 FASE 2 read-only cross-tenant A/B (authorized)
- Confirmado em `127.0.0.1:5437/mf_rls_staging` com `mf_app_nobypass` + GUCs `app.tenant_id/app.user_id/app.is_admin=false`: Tenant/User/Invoice/InvoiceItem/Product/StockMovement mostraram apenas dados do tenant do contexto (A ou B); IDs do outro tenant retornaram 0; `AdminAuditLog`/`PlatformTeamInvite` ocultados sem `app.is_admin`. `SET LOCAL` restaurado após COMMIT/ROLLBACK.
- **Reduz incerteza** de RLS para SELECT nas tabelas testadas, mas **não elimina**: `mf_app_login/mf_admin_login` behavior não comparado, ligação real app/`DATABASE_URL`/pooling não testada, WITH CHECK/mutações (T7/T13/T16/T17) não testadas, ProductWarehouseStock/PlatformTeamInvite com dados limitados no par testado, `FORCE RLS` off, 4 auth tables RLS off, grants amplos.
- Próxima ação segura (somente com autorização explícita): W1 User WITH CHECK (maior valor, menor complexidade que W4), depois W2/W3/W4 conforme proposta em `SECURITY_READONLY_CROSS_TENANT_AB_2026-11-07.md`.
## 2026-11-07 — W1 preparado (não executado)
- Policy `User` WITH CHECK admin/self-only torna bloqueio esperado para update cross-user same-tenant sob `app.is_admin=false`. Dados adequados existem (tenant `aaaaaaaa...0001`, users `...a1` actor / `...e1` target). Sem triggers/rules em `User`; várias FKs referenciam `User(id)` — W1 DB-only não deve alterar `id`; sem campo benigno óbvio (requer aprovação de campo). Plano em `SECURITY_W1_PREPARATION_2026-11-07.md`. Estado: **NOT TESTED** (aguarda `AUTORIZO W1 EXECUTAR` + campo + ROLLBACK/COMMIT regras).
