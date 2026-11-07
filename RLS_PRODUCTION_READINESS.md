# RLS_PRODUCTION_READINESS.md
**Date:** 2026-11-05 (updated after focused auth-flows fix)
**Overall:** **NOT PRODUCTION READY.**
**Production clearance:** **NOT APPROVED.**

Evidências positivas existem **apenas** em PostgreSQL local independente `mf_rls_staging` (`127.0.0.1:5437`), roles NOBYPASSRLS para validação/runtime conforme artefactos. Produção Supabase **não alterada**. WMS staging `5436/wms_staging` **não alterado** (fora do âmbito desta execução). Nenhuma migration/reset/destruição. Nenhum push/merge/commit criado nesta fase.

## Status by area
| Area | Status | Why |
|---|---|---|
| Production data/migrations/env | **NOT PROVEN / BLOCKED** | No Supabase/5436/production access or migration execution authorized or performed. |
| DB runtime identity (5437 staging) | **PASS** | `runtime-db-identity.json`: `mf_rls_staging/mf_app_login`, `rolsuper=false`, `rolbypassrls=false`, `Tenant RLS=true`, app GUCs match session. Temp route removed. Focused 3033 run referenced prior identity proofs; launcher enforces `tmp/.env.rls-e2e-5437` (5437). |
| RLS policies/coverage (5437) | **PASS (staging subset)** | 47 relations RLS ON; dbOnly 0 (prior evidence). DB regressions **re-run 2026-11-05**: 19/19, 60/60, 5/5 PASS. |
| HTTP A/B isolation (subset) | **PASS** | Products/warehouses/customers own reads + cross-tenant ID access blocked, no leak (`http-isolation-ab-extended.json`); light warehouse regression in `auth-flows-final.json`. |
| Auth HTTP basics | **PASS (partial)** | Login A/B/admin fixture, invalid credentials, no-tenant fixture login, session independence, logout, unauth guards PASS. |
| Auth verify/reset/onboarding selected flows | **PASS (controlled subset)** | 5437 HTTP (`auth-flows-final.json`, port 3033): verify/reset nonexistent/invalid tokens **controlled 400** (not 500); short reset password 400; forgot/resend generic 200; onboarding unauth 401, valid no-tenant 200, repeated idempotent 200; session refresh after onboarding 200. |
| Auth token lifecycle full matrix | **NOT PROVEN** | Expired/consumed/cross-user/valid verify-reset success paths **NOT EXECUTED** (no safe synthetic `EmailActionToken` fixtures; DB had no EmailActionToken rows on inspection). Register/issuance→consume end-to-end **NOT EXECUTED**. |
| PrismaAdapter/OAuth/NextAuth full flows | **NOT PROVEN / AT RISK** | Global adapter; adapter tables RLS OFF on 5437 prototype; OAuth HTTP not executed. |
| Adapter tables security posture | **AT RISK** | `Account/Session/VerificationToken/EmailActionToken` RLS OFF in 5437 prototype (compatibility, not production posture). |
| Admin HTTP matrix | **NOT EXECUTED** | Only admin fixture login + anon payment 401 sampled previously. |
| Financial cycle HTTP | **NOT EXECUTED** | CRUD→issue→PDF→payments partial/total→history/balances/receivables/reports/cancel/reversal/PDF protection/cross-tenant finance access not executed. |
| WMS full HTTP | **NOT EXECUTED** | Preexisting WMS work preserved; no full authenticated HTTP cycle executed in this phase. |
| Pooling/PgBouncer/transaction pooling | **NOT PROVEN** | Isolated dev runtimes only; tx-local `set_config(...,true)` strategy not validated under Supabase pooler. |
| Schema drift/migrations | **AT RISK** | `public._prisma_migrations` absent in 5437 while `prisma migrate status` reported migrations applied up to `20261102000000_stock_composite_tenant_fk`; additive compat drift applied locally; no production migration plan executed. `User.tenantRole` 5437 NOT NULL/default vs Prisma optional (staging drift). |
| Operational safety | **AT RISK** | Next loads `.env.local,.env`; launchers inject 5437 vars but precedence risk remains. No production-safe config proof. |

## 2026-11-05 working-tree fix (not committed)
- `src/lib/email-actions.ts`: removed nested `tx.$transaction(async (inner)=>...)` inside `runAsSystem` (Prisma tx client). Root cause of verify/reset 500s: `tx.$transaction is not a function` in Next runtime. Token operations now run in the single `runAsSystem` transaction.
- `src/app/api/onboarding/company/route.ts`: tenant bootstrap create via narrow `runAsSystem`; guarded user-link update preserved. No auth mechanism change.
- Instrumentação temporária (`_debug`) removida; sem rotas de debug ativas.

## Preconditions before production
1. Execute approved migration/role/RLS plan on authorized target only, with backup/rollback and no BYPASSRLS for app runtime roles.
2. Prove runtime DB identity and NOBYPASSRLS in the real deployment path (including pooling mode).
3. Execute full HTTP A/B E2E: auth (including OAuth/adapter compatibility or explicit non-use decision), **verify/reset token lifecycle (expired/consumed/cross-user/valid)**, onboarding edge cases, admin matrix, financial cycle, WMS cycle, cross-tenant negatives, payload manipulation, PDF protection, reports/balances, idempotency/concurrency.
4. Resolve adapter-table RLS posture or formally accept/mitigate with least-privilege design.
5. Resolve schema migration drift and produce reproducible, reviewed migration artifacts.
6. Re-run and pass all targeted automated suites and HTTP E2E on the authorized environment.

## Clearance
**No production clearance.** 5437 staging evidence is **partial and positive for executed subsets only**. Any production claim based on these results is invalid.

---

## 2026-11-05 addendum — stale-JWT exposure (5437 evidence only)
**JWT/session revocation:** remains **FAIL/NOT PRODUCTION READY**. Stale pre-logout JWT accepted on 5437 for own-tenant reads (products/customers/reports/SAFT/stock) and **confirmed write** (POST /api/customers, DB mutation cleaned). Admin proof route accepted stale admin JWT past auth boundary (404 vs 401). No structural revocation implemented. Fiscal/financial/admin-full/desktop bootstrap POST/onboarding/stock valid-mutation matrix NOT EXECUTED. See RLS_STALE_JWT_SENSITIVE_ROUTES_REPORT.md. **Production clearance still NOT APPROVED.**

---

## 2026-11-05 — JWT revocation architecture proposal (docs only)
Design phase completed: JWT_REVOCATION_ARCHITECTURE_PROPOSAL.md, JWT_REVOCATION_OPTIONS_COMPARISON.md, JWT_REVOCATION_MIGRATION_PLAN.md, JWT_REVOCATION_ACCEPTANCE_TESTS.md. Recommended A+/E-lite (JWT + jti revocation + centralized fail-closed validation + sessionVersion global/coarse). **No implementation performed.** Stale-JWT exposure remains unmitigated in code. **Production clearance remains NOT APPROVED.**
