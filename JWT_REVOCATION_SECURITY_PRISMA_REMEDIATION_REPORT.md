# JWT_REVOCATION_SECURITY_PRISMA_REMEDIATION_REPORT

**Date:** 2026-11-06  
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch:** `wms-v2-e2e-staging`  
**Scope:** remediação/validação **exclusiva em laboratório** PostgreSQL 17.11 `127.0.0.1:5440` (containers/DBs `mf_rls_*`) + artefactos `tmp/jwt-revocation-baseline-lab/remediation/`. **Staging original `127.0.0.1:5437/mf_rls_staging` NÃO foi escrita** (acesso `postgres` a 5437 recusado por password neste ambiente; nenhuma operação DDL/DML foi dirigida a 5437). Sem 5436/Supabase/produção; sem alterações em `.env`/`.env.local`/`prisma/schema.prisma` oficial/`prisma/migrations/*` oficiais/código Auth-NextAuth; sem commits/push/merge/deploy/reset/clean.

## 1. Estado inicial (preservado)
| Item | Resultado |
|---|---|
| Branch | `wms-v2-e2e-staging` (**PASS**) |
| `git status --short` antes | Worktree preexistente pesado preservado (M/?? incluindo `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/auth-prisma-adapter.ts`, WMS/stock/auth/RLS, relatórios/artefactos `tmp/*`). **PASS (preservado)** |
| `git status --short` depois | Inalterado; novos untracked apenas sob `tmp/jwt-revocation-baseline-lab/remediation/` e este relatório. **PASS** |
| Oficial não alterado | `.env*`, schema Prisma oficial, migrations oficiais, código auth | **PASS** |
| 5437 escrita | **Nenhuma** | **PASS** |

Backups/preservação existentes (não removidos): `remediation/backup/lab1_pre_remediation.backup`, `remediation/backup/remed_v2c.backup`, `phase-1e/backup/lab1.backup`. DBs descartáveis usados/criados: `mf_rls_remed_v4` (template `mf_rls_remed_v2c`), `mf_rls_remed_v5` (template `mf_rls_baseline_lab2`). Restore de backup: **NOT EXECUTED**.

## 2. VULN-1 — fronteira administrativa / RLS (ALTA)

### Causa raiz confirmada
Policies usavam `current_setting('app.is_admin',true)='true'` (GUC setável por role de aplicação NOBYPASSRLS) — 1E demonstrou bypass. v1 usou `session_user` e falhou quando um superuser fazia `SET ROLE` mantendo `session_user`.

### Implementação candidata (lab)
- `mf_is_admin_executor() RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE`: `current_user = 'mf_admin_executor'`. **Vantagem:** não depende de GUC setável; `current_user` muda com `SET ROLE/SET LOCAL ROLE`. **Controlos requeridos:** roles de app login **não podem** ter membership/admin option para `SET ROLE mf_admin_executor`; `mf_admin_executor` NOLOGIN NOBYPASSRLS NOINHERIT.
- Substituição literal/segura de `app.is_admin` / `mf_has_admin_context()` por `mf_is_admin_executor()` em policies (DO block). **Validado em `mf_rls_remed_v5`: 47/47 policies convertidas, 0 `app.is_admin` remanescentes.** `mf_rls_remed_v4`/v2c/v3: 49 policies, 48 com `mf_is_admin_executor`, 0 `app.is_admin`.
- Coverage v4: **0 policies com `app.is_admin`/`mf_has_admin_context` remanescentes**; RLS ON sem policy = 0. RLS OFF pré-existente: `Account, EmailActionToken, Session, VerificationToken` (**NOT PROVEN safe**, fora desta remediação).

### Modelo real da aplicação (inspecção, não alterado)
`src/lib/tenant-db.ts`: `prisma.$transaction` + `set_config('app.tenant_id'|'app.user_id'|'app.is_admin', ..., true)` (local à transação). **Sem `SET ROLE` no trecho.** `prisma.ts`: `new PrismaClient()` simples. Pooling/PgBouncer/Supabase/grants runtime reais: **NOT PROVEN**.

### Validação VULN-1 (v4, ligação independente `v4_app_login` NOBYPASSRLS NOINHERIT, memberships 0)
| Teste | Resultado |
|---|---|
| `current_user/session_user=v4_app_login`, `mf_is_admin_executor()=false`, `is_superuser=off` | **PASS** |
| Role flags `rolsuper=false, rolbypassrls=false, rolinherit=false, rolcanlogin=true`; memberships 0 | **PASS** |
| Tenant A lê só próprios (Customer/Product/Invoice/Warehouse/StockMovement/PurchaseOrder) | **PASS** |
| Tenant A não vê B / InvoiceItem cross-tenant via Invoice | **PASS** |
| Spoof `app.is_admin=true` não expande acesso | **PASS** (domínios testados = 1 row, só tenant A) |
| Spoof `app.tenant_id='tb'` não lê A | **PASS** |
| UPDATE/DELETE cross-tenant | **PASS** (rowCount 0) |
| INSERT cross-tenant | **PASS** (RLS violation) |
| Sem tenant/user/admin | **PASS** (0 rows) |
| `SET ROLE mf_admin_executor` negado | **PASS** |
| `SET SESSION AUTHORIZATION mf_admin_executor` negado | **PASS** |
| Admin legítimo (`remed_admin_login` + membership `mf_admin_executor` NOINHERIT, `SET ROLE`) | **PASS** (executor efectivo, acesso admin; sem SET ROLE/fn admin bloqueada) |
| 48 policies adminish usam `mf_is_admin_executor` (v4/v5) | **PASS (candidate/lab)** |
| Memberships reais `mf_app_login` em 5437/staging | **NOT PROVEN** (5437 read-only; credenciais app login não validadas em ambiente real) |
| Transaction pooling (PgBouncer) + `set_config(...,true)`/SET ROLE lifecycle | **NOT PROVEN** |
| CRUD exaustivo em todas as 48 policies/domínios | **PARTIAL** (amostral representativo) |

**VULN-1:** **PASS (lab/candidato)** para bypass GUC e isolamento CRUD amostral com ligação app independente. **NOT PROVEN** para grants/memberships/pooling reais de staging/produção.

## 3. VULN-2 — integridade auditoria `AuthJwtRevocation` (MÉDIA)

### Implementação candidata (v4 validada)
- Direct INSERT removido do app path: `ajr_self_insert` dropada; app path **SELECT only** em AJR (INSERT/UPDATE/DELETE negados). **PASS**.
- `mf_revoke_jwt_self(...)` SECURITY DEFINER, `SET search_path=public`, owner `mf_jwt_writer` (NOLOGIN NOBYPASSRLS NOINHERIT). Policy `ajr_jwt_writer_insert` FOR INSERT TO `mf_jwt_writer` WITH CHECK (true) — controlo efectivo na função + grants/EXECUTE. App login não pode `SET ROLE mf_jwt_writer`. **PASS**.
- Binding/controlos: `v_uid = NULLIF(current_setting('app.user_id',true),'')` deve igualar `p_user_id`; `jtiHash` trim + length>=32; `reason='logout'`, `actorUserId=v_uid`, `metadata={"source":"self"}` fixos; `ON CONFLICT ("jtiHash") DO NOTHING`. **PASS**.
- `mf_revoke_jwt_admin(...)` SECURITY DEFINER, owner `mf_admin_executor`, `search_path=public`, exige `mf_is_admin_executor()`; `reason` allowlist (`logout_all,password_change,suspended,security,admin`); idempotência. EXECUTE negado a app; admin sem `SET ROLE` negado; após `SET ROLE` legítimo **PASS**.
- `REVOKE ALL FROM PUBLIC` em funções; EXECUTE mínimo. **PASS**.

### Testes VULN-2
| Teste | Resultado |
|---|---|
| INSERT directo negado (app login) | **PASS** |
| Self-revoke legítimo (ua/ua) | **PASS** |
| Idempotência self/admin | **PASS** |
| Revogação de terceiro via self negada | **PASS** (`revocation user binding mismatch`) |
| `jtiHash` inválido/curto rejeitado | **PASS** |
| Admin fn como app login | **PASS negado** |
| Admin fn sem SET ROLE executor | **PASS negado** |
| Admin fn após SET ROLE executor legítimo | **PASS** |
| `reason` admin fora allowlist | **PASS negado** |
| SELECT próprio / outro utilizador | **PASS** (1 / 0) |
| UPDATE/DELETE não autorizados | **PASS negado** |
| `mf_jwt_writer` abuso por app login | **PASS negado** |
| Unicidade `jtiHash` / cleanup `expiresAt` / validação runtime | **PARTIAL / NOT PROVEN** (índice/ON CONFLICT ok; cleanup/validator runtime **não implementado**, fora autorização) |
| `actorUserId` forjável? | **PASS (funções controlam)**; binding organizacional admin actor **NOT PROVEN** além do parâmetro |
| RLS FORCE + SECURITY DEFINER interplay exaustivo | **PARTIAL** (ownership dedicada aplicada/testada em v4) |

**VULN-2:** **PASS (lab/candidato)** para self-insert directo, funções controladas, idempotência/binding/allowlist/EXECUTE. **NOT PROVEN** para integração app (mint/check/revoke/logout/refresh/NextAuth), cleanup/expiração operacional e ambiente real.

## 4. VULN-3 — reconciliação Prisma baseline (MÉDIA/ALTA)

### Achados (não destrutivos; nenhuma drop/create aplicada em DBs existentes)
`prisma migrate diff --from-url lab2 --to-schema-datamodel prisma/schema.prisma` (1E) propôs: **2 DropForeignKey, 8 DropIndex, 29 CreateIndex, 1 CreateTable AuthJwtRevocation**.

| Item | Achado | Decisão |
|---|---|---|
| `StockMovement_tenantId_fkey`, `Warehouse_tenantId_fkey` | lab2: `ON DELETE CASCADE`; schema Prisma: relação sem `onDelete` → diff quer drop+add `RESTRICT` | **NÃO aplicar.** Requer decisão de produto/migração (cascade vs restrict) + teste em cópia descartável. **NOT PROVEN safe**. |
| 8 DropIndex (`BusinessDocument_*`, `Email*`, `PlatformTeamInvite_*`) | Índices existem e parecem válidos; schema worktree diverge | **Preservar.** Reconciliar índice-a-índice; nunca aceitar drops cegos. **NOT PROVEN**. |
| 29 CreateIndex / rename FK | Podem ser úteis mas exigem verificação de duplicidade/nomes/viabilidade online; alguns semanticamente diferentes (ex.: `Product_tenantId_barcode_key` em lab2 é partial `WHERE (barcode IS NOT NULL)`, schema declara unique sem filtro) | **NOT PROVEN safe**. |
| `CreateTable AuthJwtRevocation` | Estrutura compatível com migration oficial; aditiva em base sem AJR | **Aceitável só como candidata controlada** onde tabela ausente; não resolve restante drift. |

### Cadeia candidata reconciliada (lab, não oficial)
`tmp/jwt-revocation-baseline-lab/remediation/candidate/v4-vuln1-vuln2-reconciled.sql` — **aditiva/controlada** (sem DROP TABLE/INDEX/FK): `mf_is_admin_executor`, substituição policies `app.is_admin`, hardening AJR (assume AJR existente). Validada em partes (VULN-1 em v5: 47/47; VULN-1+VULN-2 em v4).

**VULN-3:** **BLOCKED / NOT PROVEN** para “diff limpo / Prisma Migrate compatível sem Drops”. **PASS** para identificação precisa e decisão de não aplicar mudanças destrutivas.

## 5. Prisma / regressão estática
| Teste | Resultado |
|---|---|
| `npx prisma validate` | **PASS** (schema válido; warnings `SetNull` preexistentes) |
| `npx tsc --noEmit -p tsconfig.json` | **PASS** (sem output de erro) |
| `prisma migrate status` / diff limpo / simulação migration aditiva futura reconciliada | **NOT EXECUTED / BLOCKED** (drift + histórico 5437 sem `_prisma_migrations`; diff propõe drops/creates não autorizados) |

## 6. Riscos residuais / bloqueios
- **VULN-1:** memberships/roles/SET ROLE/pooling reais em staging/5437/produção **NOT PROVEN**. `tenant-db.ts` ainda escreve `app.is_admin` GUC (dead/confusing após migração de policies) — **não alterado**.
- **VULN-2:** integração NextAuth/JWT mint/check/revoke/logout/refresh **não implementada**; cleanup `expiresAt`/job e revogação central fail-closed runtime **NOT PROVEN**.
- **VULN-3:** diff Prisma com drops/recreates/índices semanticamente diferentes; 5437 sem `_prisma_migrations` (safety gate). **BLOCKED**.
- RLS OFF pré-existente `Account,EmailActionToken,Session,VerificationToken`. **NOT PROVEN**.
- Testes HTTP/NextAuth/adapters/concorrência/pooling: **NOT EXECUTED**.
- Credencial `mf_app_login` real staging/5437: **NOT PROVEN** (não obtida; não alterada).

## 7. Recomendação para Fase 1F (somente após autorização explícita)
1. Read-only complementar em 5437 com credenciais mínimas legítimas: memberships/grants `mf_*`, policies/FKs/índices reais; confirmar ausência de membership app→`mf_admin_executor`. Sem escritas.
2. Decidir VULN-3: (a) `ON DELETE RESTRICT` vs `CASCADE` para `StockMovement/Warehouse->Tenant`; (b) catálogo índice-a-índice (preservar/renomear/aditivo sem drops); (c) uniques parciais (ex. `Product_tenantId_barcode_key`). Ajustar schema/SQL em cópia descartável até diff limpo.
3. Em DB descartável com histórico controlado: aplicar cadeia candidata + migration JWT aditiva; obter diff limpo/lista justificada; simular migration futura aditiva.
4. Só então, com backup verificado e janela aprovada: aplicar VULN-1/VULN-2/AJR em 5437 por caminho autorizado. **Não executar 1F, integração app, deploy ou produção nesta autorização.**

## 8. Conclusão consolidada
| Frente | Classificação | Notas |
|---|---|---|
| VULN-1 (app.is_admin GUC bypass) | **PASS (lab/candidato); NOT PROVEN (staging real)** | Bypass eliminado por `mf_is_admin_executor()`; RLS/CRUD cross-tenant amostral PASS com ligação app independente; pooling/memberships reais pendentes. |
| VULN-2 (auditoria AuthJwtRevocation) | **PASS (lab/candidato); NOT PROVEN (app integration)** | Direct insert removido; funções controladas/idempotentes; grants/EXECUTE validados; runtime check/cleanup não implementados. |
| VULN-3 (Prisma baseline) | **BLOCKED / NOT PROVEN** | Drift real (FK cascade/restrict, índices/uniques divergentes). Nenhuma alteração destrutiva aplicada. |
| Multi-tenant RLS / Admin / AJR auditoria | **PASS (amostral, lab)** | — |
| Compatibilidade Prisma Migrate | **NOT PROVEN / BLOCKED** | — |
| Regressões estáticas | **PASS** | `prisma validate`, `tsc --noEmit` |

**A remediação NÃO pode ser declarada globalmente concluída** enquanto VULN-3 permanecer BLOCKED/NOT PROVEN e enquanto validação real de staging (memberships/pooling/runtime) e integração app permanecerem fora de prova/autorização.

**Artefactos:**
- Relatório: `JWT_REVOCATION_SECURITY_PRISMA_REMEDIATION_REPORT.md`
- Candidato SQL: `tmp/jwt-revocation-baseline-lab/remediation/candidate/v4-vuln1-vuln2-reconciled.sql`
- Evidência DB state: `tmp/jwt-revocation-baseline-lab/remediation/evidence/db-state-summary.json`
- Scripts de validação: `tmp/jwt-revocation-baseline-lab/remediation/scripts/*` (somente 5440/lab)
- Bases descartáveis: `mf_rls_remed_v4`, `mf_rls_remed_v5` (5440, preservadas até revisão)

**Sem commits. Sem escritas em 5437/5436/produção. Sem Fase 1F/app integration.**