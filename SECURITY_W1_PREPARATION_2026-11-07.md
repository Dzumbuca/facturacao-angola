# W1 Preparation (READ-ONLY, NOT EXECUTED) — 2026-11-07
**Target:** `127.0.0.1:5437/mf_rls_staging` (`machine-stock-test-pg`, PostgreSQL 17.11). **No mutations authorized/executed.** No seeds/migrations/code/policy/role/permission/production/Supabase changes.

## FASE 1 — Dados existentes (SELECT only; no PII)
Tenant with >=2 users (confirmed): `aaaaaaaa-0000-4000-8000-000000000001` (3 users).
| ID | tenantId | tenantRole | platformRole | status | emailVerificationRequired | email_verified | sessionVersion | createdAt | has_password |
|---|---|---|---|---|---|---:|---:|---|---|
| `aaaaaaaa-0000-4000-8000-0000000000a1` | aaaaaaaa...0001 | COMPANY_ADMIN | NONE | ACTIVE | f | t | 1 | 2026-11-05 16:23:12.369 | t |
| `cccccccc-0000-4000-8000-0000000000c1` | aaaaaaaa...0001 | COMPANY_ADMIN | SUPERADMIN | ACTIVE | f | t | 1 | 2026-11-05 16:23:12.369 | t |
| `eeeeeeee-0000-4000-8000-0000000000e1` | aaaaaaaa...0001 | USER | NONE | ACTIVE | t | f | 1 | 2026-11-05 21:40:09.315 | t |

Selected (same tenant, different IDs, ACTIVE): **Actor A = `aaaaaaaa-...-a1`**, **Target B = `eeeeeeee-...-e1`** (avoids SUPERADMIN app-platform ambiguity of c1; both same tenant). Confirmation: actor_tenant=target_tenant=`aaaaaaaa...0001`.

**Candidate test fields (non-sensitive, reversible conceptually; actual mutation not authorized):** `User` has no benign free-text field exposed in metadata scan except sensitive/auth/profile fields (`name/email/image/password` not acceptable). `tenantRole` is enum-like business field (A is COMPANY_ADMIN; B is USER) — changing it is sensitive. `emailVerificationRequired`/`status` sensitive. **Conclusion:** there is no clearly non-sensitive low-risk field. Preferred W1 probe, if later authorized, should use `BEGIN; <UPDATE attempt>; ROLLBACK;` on a minimal field such as `status` kept equal (`status=status` not useful) or a reversible controlled field only with explicit data-owner approval; alternatively test by attempting `UPDATE "User" SET "sessionVersion" = "sessionVersion" WHERE id=<target>`? `sessionVersion` affects sessions/security semantics; still sensitive. **W1 requires explicit approval of target field and data risk; do not improvise.**

## FASE 2 — Política RLS `User`
`relrowsecurity=t, relforcerowsecurity=f, owner=postgres`. Policy `rls_user_self_tenant_admin` (`PERMISSIVE`, `ALL`, roles `{public}`):
- **USING:** `app.is_admin='true' OR (app.user_id<>'' AND app.user_id=id) OR (app.tenant_id<>'' AND tenantId IS NOT NULL AND app.tenant_id=tenantId)`
- **WITH CHECK:** `app.is_admin='true' OR (app.user_id<>'' AND app.user_id=id)`

**Interpretação para W1 (actor updates different same-tenant target, `app.is_admin=false`):**
- Row visibility: USING allows same-tenant read (`app.tenant_id` matches). Actor can *see* target row.
- Update permission: WITH CHECK requires admin **or self** (`app.user_id=id`). Actor `a1` updating target `e1` with `app.user_id=a1` satisfies neither branch when `app.is_admin=false`. **Expected DB result if executed under RLS-enforced app role + those GUCs: UPDATE blocked by RLS / 0 rows affected due to policy/with check behavior (exact error/rows depend on executor/path); operationally FAIL to modify target = PASS for isolation control.**

## FASE 3 — Triggers, funções, constraints, efeitos secundários
- **Triggers on `User`:** none (pg_trigger, non-internal) = 0 rows. **Rules:** none.
- **Functions called by triggers:** none found.
- **Constraints on `User`:** PK `id`; FK `User_tenantId_fkey` → `Tenant(id)` `ON UPDATE CASCADE ON DELETE SET NULL`.
- **Tables referencing `User(id)` (potential side effects of User UPDATE/DELETE; W1 would be UPDATE):**
  - `Account.userId` CASCADE/CASCADE
  - `AdminAuditLog.actorUserId` CASCADE/SET NULL
  - `BusinessDocument.createdByUserId` CASCADE/SET NULL
  - `BusinessDocumentEvent.actorUserId` CASCADE/SET NULL
  - `EmailActionToken.userId` CASCADE/CASCADE
  - `EmailCampaign.createdById` CASCADE/RESTRICT
  - `EmailDelivery.sentByUserId` CASCADE/SET NULL
  - `MarketingPreference.userId` CASCADE/CASCADE
  - `Payment.createdByUserId` CASCADE/SET NULL
  - `PaymentEvent.actorUserId` CASCADE/SET NULL
  - `PlatformConfig.updatedByUserId` CASCADE/SET NULL
  - `PlatformTeamInvite.createdById` CASCADE/RESTRICT
  - `Session.userId` CASCADE/CASCADE
  FK `ON UPDATE CASCADE` means changing `User.id` would cascade; W1 must **never** change `id`. `ON DELETE` effects irrelevant if only UPDATE. No DB triggers/functions observed => no trigger side effects from a simple column UPDATE (still subject to app logic outside DB; W1 plan below is DB-level only).
- **External/non-transactional effects:** not observable via DB metadata. App may react to user changes (sessions, emails, audit, caches); DB-only test in staging still risks logical side effects if committed. **Prefer `ROLLBACK` inside same tx.**

## FASE 4 — Plano técnico W1 (proposta; NÃO EXECUTAR)
- **Tenant:** `aaaaaaaa-0000-4000-8000-000000000001`
- **Actor A:** `aaaaaaaa-0000-4000-8000-0000000000a1` (COMPANY_ADMIN, ACTIVE, same tenant)
- **Target B:** `eeeeeeee-0000-4000-8000-0000000000e1` (USER, ACTIVE, same tenant, not SUPERADMIN platform role)
- **Role pretendida:** `mf_app_nobypass` (validated safe switch: `SET LOCAL ROLE` in READ ONLY tx previously; for write tx requires explicit authorization). **Limitation:** session origin `postgres` container client; this is DB role/policy test, not real app connection test. Do **not** use postgres superuser privileges to simulate app behavior.
- **GUCs necessárias (tx-local):**
  - `set_config('app.tenant_id','aaaaaaaa-0000-4000-8000-000000000001', true)`
  - `set_config('app.user_id','aaaaaaaa-0000-4000-8000-0000000000a1', true)`
  - `set_config('app.is_admin','false', true)`
- **SQL exacto proposto (NÃO EXECUTADO):**
```sql
BEGIN;
SET LOCAL ROLE mf_app_nobypass;
SELECT current_user, session_user, current_setting('app.tenant_id',true), current_setting('app.user_id',true), current_setting('app.is_admin',true);
SELECT set_config('app.tenant_id','aaaaaaaa-0000-4000-8000-000000000001', true);
SELECT set_config('app.user_id','aaaaaaaa-0000-4000-8000-0000000000a1', true);
SELECT set_config('app.is_admin','false', true);

-- Pre-state (IDs/non-sensitive metadata only)
SELECT id, "tenantId", status, "sessionVersion", "emailVerificationRequired" FROM "User" WHERE id='eeeeeeee-0000-4000-8000-0000000000e1';

-- W1 probe (FIELD REQUIRES EXPLICIT APPROVAL; example placeholder)
-- UPDATE "User" SET <approved_reversible_field>=<approved_value> WHERE id='eeeeeeee-0000-4000-8000-0000000000e1';
-- SELECT id, <approved_reversible_field> FROM "User" WHERE id='eeeeeeee-0000-4000-8000-0000000000e1';

ROLLBACK; -- mandatory unless separate explicit COMMIT+cleanup authorization is granted
-- Post-check (optional, read-only): verify target unchanged
```
- **Resultado esperado:** UPDATE **bloqueado** por RLS `WITH CHECK` (actor não é admin nem self) — `UPDATE 0`/RLS error conforme caminho; target inalterado após ROLLBACK.
- **Estratégia de rollback:** `ROLLBACK` obrigatório na mesma transação. Sem `COMMIT`. Sem `DELETE` cleanup. Se, por erro operacional, houver commit (não autorizado), parar e reportar imediatamente com IDs afetados.
- **Critérios PASS/FAIL/BLOCKED:**
  - **PASS (controlo eficaz):** com `mf_app_nobypass` + GUCs acima, tentativa de UPDATE em target B é rejeitada (erro RLS) ou afeta 0 linhas; target permanece inalterado.
  - **FAIL (risco):** UPDATE afeta 1 linha em target B com `app.is_admin=false` e `app.user_id` do actor.
  - **BLOCKED:** role switch não autorizado/seguro; campo de teste não aprovado; dados alterados inesperadamente; falta autorização de mutação.

## Riscos conhecidos
- `User.platformRole/tenantRole/status/sessionVersion/email*` são sensíveis; target `e1` tem `emailVerificationRequired=t,email_verified=f` — evitar tocar.
- `relforcerowsecurity=f` e grants amplos existem; W1 testa política sob role não-superuser/nobypassrls.
- `SUPERADMIN` em `c1.platformRole` é atributo de app na linha User, não `app.is_admin` GUC; não usar c1 como actor/target para evitar ambiguidade de interpretação.

## Autorização necessária (aguardar)
Fornecer explicitamente: `AUTORIZO W1 EXECUTAR`, role (`mf_app_nobypass`), confirmação de que `BEGIN;...ROLLBACK;` conta como mutação controlada autorizada ou não, campo exato aprovado para probe (ou método alternativo aprovado), e confirmação alvo `127.0.0.1:5437/mf_rls_staging`. Sem isso: **não executar**.
