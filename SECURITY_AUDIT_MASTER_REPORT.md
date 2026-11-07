# Security Audit Master Report — Machine Facturas (updated 2026-11-06 follow-up)
**Branch:** `wms-v2-e2e-staging` @ `95e00365` (current `git status` at audit start showed dirty tree; commit ref from mission context `95e00366` noted in prior reports) — **verify exact HEAD before release decisions**.
**Scope:** F-001–F-006 follow-up + Phase 1J risk areas, targeted WMS hardening/tests, RLS policy matrix from repo SQL, central RLS helper guardrail. Prior audits/reports reviewed, not re-executed.
**Constraints observed:** No production/Supabase DB access or changes; no migrations/RLS/GRANT/role application; no credential exposure; no destructive commands; preexisting ~411 changed/untracked files preserved; no blanket commit.

## Executive decision
**CONDITIONAL GO for reviewed app-layer code paths only; overall tenant/RLS security remains NO-GO for production proof.**
- **GO evidence (limited):** targeted WMS routes hardened and covered by passing Vitest suites (adjustments 3/3, transfers 2/2, purchase receptions 9/9, reservations 8/8); F-004 helper guard + tests (tenant-db 6/6, admin-auth 11/11 regression); F-005 logging removed; F-006 read path aligned to `runWithTenant`; ad-unlock core 6/6.
- **NO-GO blockers:** no authorized live DB/RLS/role/grant validation, no 2-tenant runtime isolation matrix, F-002/F-003 runtime/policy boundaries unconfirmed, full TS/ESLint/build/integration not executed, 5437 read-only audit still credential-blocked.

## Deliverables
- `SECURITY_AUDIT_MASTER_REPORT.md`, `SECURITY_FINDINGS.md`, `SECURITY_FIXES_REPORT.md`, `SECURITY_REMAINING_RISKS.md` (updated)
- `SECURITY_RLS_MATRIX.md` (new, repo-SQL evidence; DB not confirmed)
- `PHASE1J_TENANT_ISOLATION_AUDIT_REPORT.md` addendum retained

## Key evidence
| Area | State | Evidence |
|---|---|---|
| F-001 WMS | MITIGATED (app-layer), NOT DB-CONFIRMED | Tenant-scoped/state/idempotency fixes in untracked routes + **22 tests passed** across affected suites. |
| F-002 Ad-unlock | OPEN/NOT CONFIRMED | `src/lib/ad-unlock-service.ts:49-57,111-130`; nested tx + manual GUCs; SQL tenant predicates present. No runtime proof. |
| F-003 Team invites | OPEN/NOT CONFIRMED | `src/lib/team-invite-actions.ts:10,71-102`; global Prisma, token/app checks, Serializable accept; DB/RLS boundary unknown. |
| F-004 Helpers | MITIGATED (code) | `src/lib/tenant-db.ts` requires `PRIVILEGED_RLS` for `runAsAdmin/runAsSystem`; `runWithTenant` forces `isAdmin:false`. Tests **6/6 + 11/11**. |
| F-005 Auth logs | FIXED | `src/app/api/auth/[...nextauth]/route.ts` no longer logs cookie names/lengths. |
| F-006 Movements | MITIGATED (app-layer) | `src/app/api/stock/movements/[id]/route.ts` read via `runWithTenant`; DELETE 403 preserved. Preexisting modified file. |
| RLS SQL matrix | BLOCKED runtime | `SECURITY_RLS_MATRIX.md`; `RLS_POLICIES_STAGING.sql`/prisma RLS SQL reviewed; live DB/roles/grants/FORCE not confirmed. |

## Not done (intentional/safe)
- No DB/RLS/policy/GRANT/role/migration/production changes.
- No blanket commit (preexisting dirty worktree).
- No weakening of controls.

## 5437 read-only inspection (confirmed 2026-11-07)
- Authorized target confirmed and inspected read-only: machine-stock-test-pg / 127.0.0.1:5437 / mf_rls_staging (postgres:17). No DB/app writes.
- Evidence: **51 public tables, 47 RLS enabled, 4 disabled** (Account,EmailActionToken,Session,VerificationToken), **0 FORCE RLS**, **47 policies** (1/table, ALL, TO PUBLIC, GUCs pp.is_admin/app.tenant_id/app.user_id, no pp.current_tenant_id). Roles: app/login roles mf_app_login,mf_admin_login,mf_auth_login no superuser/bypassrls; postgres superuser/bypassrls. Grants: mf_app_login/mf_admin_login/mf_app_nobypass broad DML on all 51 tables; mf_auth_login scoped; mf_migration broad.
- Decision impact: improves DB-state evidence but **does not prove runtime tenant isolation** (GUC discipline, app role/config, 2-tenant flows, F-002/F-003 runtime). Overall remains **CONDITIONAL GO (validated app-layer paths) / NO-GO for production-proof multi-tenant isolation**.
## 2026-11-07 — FASE 2 read-only cross-tenant A/B (authorized, completed)
- Alvo exclusivo: `127.0.0.1:5437/mf_rls_staging` (`machine-stock-test-pg`, PG 17.11). Métodos: `SELECT`/metadados; `BEGIN READ ONLY` + `SET LOCAL` GUCs; `SET LOCAL ROLE mf_app_nobypass` (membership explícita confirmada via `pg_auth_members`). Sem SET ROLE persistente, sem DML/DDL, sem seeds/cleanup, sem produção.
- **FASE 1:** Tenant A `000...a001`/User A `000...a011`; Tenant B `000...b002`/User B `000...b012`; bindings confirmados; dados suficientes (Invoice/InvoiceItem/Product/StockMovement presentes; ProductWarehouseStock 0 para A/B; PlatformTeamInvite 0 global).
- **FASE 2/3 (RLS policy + role mf_app_nobypass):** Contexto A e B, `app.is_admin=false`. Visibilidade total limitada ao próprio contexto: Tenant/User/Invoice/InvoiceItem/Product/StockMovement = 1 próprio, 0 outro tenant. `AdminAuditLog`=0 visível (8 reais no DB), `PlatformTeamInvite`=0.
- **FASE 4 (cross-ID):** consultas diretas por IDs conhecidos do outro tenant retornaram 0 em Tenant/User/Invoice/InvoiceItem/Product/ProductWarehouseStock/StockMovement. **Nenhum dado cross-tenant visível sob o contexto testado.**
- **FASE 5:** após `COMMIT` e `ROLLBACK`, `current_setting(app.tenant_id/user_id/is_admin,true)` vazios e `current_user` retornou a `postgres` na sessão — `SET LOCAL`/`SET LOCAL ROLE` não persistiram.
- **Classificação:** política RLS = PASS (tabelas/contextos testados). Role assumida = PASS apenas `mf_app_nobypass`; `mf_app_login`/`mf_admin_login` behavioral **BLOCKED** (sem switch seguro executado). Ligação real da aplicação = **NOT TESTED**.
- **Postura:** evidência forte de ocultação cross-tenant A↔B em SELECT sob `mf_app_nobypass`+GUCs; mantém **CONDITIONAL GO** controlado / **NO-GO** para segurança comprovada da aplicação em produção. Testes de escrita W1–W4 propostos em `SECURITY_READONLY_CROSS_TENANT_AB_2026-11-07.md`; **aguardar nova autorização**.
## 2026-11-07 — W1 preparação (read-only, NÃO executado)
- Dados existentes suficientes: tenant `aaaaaaaa-0000-4000-8000-000000000001` com 3 users (IDs confirmados, sem PII). Seleção proposta: Actor `aaaaaaaa-...-a1`, Target `eeeeeeee-...-e1` (mesmo tenant, ACTIVE).
- Policy `User.rls_user_self_tenant_admin` (ALL, PERMISSIVE, RLS on, FORCE RLS off): USING permite same-tenant read; **WITH CHECK permite apenas `app.is_admin='true'` ou self (`app.user_id=id`)**. Para actor A atualizando target B com `app.is_admin=false`, bloqueio é **esperado**.
- Efeitos secundários: **0 triggers/rules** em `User`; FKs relevantes com `ON UPDATE CASCADE` de `User.id` (W1 não pode alterar id) e várias refs `ON DELETE` (irrelevantes para UPDATE). Campos User contêm dados sensíveis/operacionais; **não há campo claramente não sensível** — campo de probe exige aprovação explícita.
- Plano W1 pronto em `SECURITY_W1_PREPARATION_2026-11-07.md` (SQL exato, ROLLBACK obrigatório, PASS/FAIL). **Nenhuma mutação executada; aguarda autorização explícita.**
