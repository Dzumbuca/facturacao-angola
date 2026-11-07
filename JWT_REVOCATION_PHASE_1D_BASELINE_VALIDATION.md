# JWT_REVOCATION_PHASE_1D_BASELINE_VALIDATION

**Date:** 2026-11-05  
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch:** `wms-v2-e2e-staging`  
**Decision:** `JWT_REVOCATION_PHASE_1C_STRATEGY_DECISION_APPROVED.md` (A preferida).  
**Scope:** baseline controlado validado **apenas em cópia descartável**. **Sem escrita na staging original.**

## 1. Estado inicial do Git
- Branch: `wms-v2-e2e-staging` (**PASS**).
- `git status --short` antes: worktree preexistente pesado preservado (M/?? WMS/RLS/stock/auth/prisma schema etc.). (**PASS**)
- `git status --short` depois: idêntico ao estado funcional anterior + untracked desta fase (`JWT_REVOCATION_PHASE_1D_BASELINE_VALIDATION.md`, `tmp/jwt-revocation-baseline-lab/`). (**PASS**)
- Sem reset/clean/checkout destrutivo, sem commit/push/merge/deploy. (**PASS**)
- `.env`, `.env.local`, `prisma/schema.prisma` oficial, migrations oficiais: **não alterados por esta fase** (schema tinha modificação preexistente preservada). (**PASS**)

## 2. Ambiente descartável criado
| Item | Valor | Classificação |
|---|---|---|
| Docker | 29.6.1 disponível | PASS |
| Container | `mf_rls_baseline_lab_5440` (PostgreSQL 17.11 Debian) | PASS |
| Porta host | `5440` (livre antes; ≠5437/5436) | PASS |
| DB | `mf_rls_baseline_lab` | PASS |
| Volume | `mf_rls_baseline_lab_5440_data` (novo) | PASS |
| Credenciais | sintéticas locais de lab (`postgres/labpass`, roles `lab_synth_*`) — não produção | PASS |
| Estado final | **preservado** (não apagado) | PASS |
| Containers/processos existentes | não interrompidos | PASS (NOT PROVEN exaustivo) |

## 3. Método de cópia
- **Origem (read-only):** `127.0.0.1:5437/mf_rls_staging` via `pg` client e `pg_dump` em container `postgres:17 --network host` (só leitura). Saídas em `tmp/jwt-revocation-baseline-lab/origin/`.
- Dumps schema-only: `schema-full.sql` (316516 bytes), `schema-no-owner-no-priv.sql` (309870 bytes). **Encoding:** redirecção PowerShell gerou UTF-16LE (BOM FF FE); convertido para UTF-8 sem BOM `schema-no-owner-no-priv.utf8.sql` (154934 bytes).
- Restauração lab: `psql -v ON_ERROR_STOP=1 -f /tmp/schema.utf8.sql` em DB vazia `mf_rls_baseline_lab` — **PASS** (51 tabelas).
- Dados reais: **não copiados**. Contagens por tabela inventariadas como metadados; valores sensíveis não expostos. (**PASS**)
- **Nenhum comando de escrita executado contra 5437/mf_rls_staging.** Verificação final origem: `AuthJwtRevocation=null`, `_prisma_migrations=null`, `tables=51`. (**PASS**)

## 4. Inventário da origem (5437, leitura)
| Categoria | Resultado |
|---|---|
| DB/versão | PostgreSQL 17.11, `mf_rls_staging`, `postgres` (admin local leitura) |
| Schemas | `public, information_schema, pg_catalog, pg_toast` |
| Tabelas base públicas | 51 |
| RLS | 47 ON, 0 FORCE, 4 OFF (`Account,EmailActionToken,Session,VerificationToken`) |
| Colunas | 520 (snapshot) |
| PKs / FKs / UNIQUEs / Índices | 53 / 93 / 2 / 169 |
| Policies | 47 (`app.is_admin`/`app.tenant_id`/GUC patterns) |
| Roles | `anon,authenticated,service_role,postgres,mf_admin_executor,mf_admin_login,mf_app_login,mf_app_nobypass,mf_auth_executor,mf_auth_login,mf_migration` (NOBYPASSRLS excepto postgres/supabase defaults) |
| Memberships | `postgres`→`mf_admin_executor,mf_app_nobypass,mf_auth_executor,mf_migration` |
| Default privileges | `postgres` função `postgres=X/postgres` |
| Funções públicas | 0 |
| Triggers | 0 |
| Extensões | `plpgsql 1.0` |
| `_prisma_migrations` | ausente |
| `AuthJwtRevocation` | ausente |

## 5. Estrutura do baseline (artefactos candidatos)
Local: `tmp/jwt-revocation-baseline-lab/`
- `origin/schema-no-owner-no-priv.utf8.sql` — DDL base (**PASS** no lab).
- `artifacts/05-rls-roles-grants.sql` / `05b-rls-roles-grants-idempotent.sql` — roles sintéticas (atributos espelhados), memberships, grants `mf_*`, ENABLE RLS, policies (geradas do inventário). (**PASS** aplicado; log parcial inicial esperado por policies já presentes no dump.)
- `lab/*.cjs,*.sql,*.log`, `evidence/*.json` — scripts/evidência.

**Separação candidata:** A) Prisma-gerido: DDL/enums/índices/FKs no dump — **NOT PROVEN** equivalência perfeita ao `prisma/schema.prisma` worktree. B) PostgreSQL personalizado: grants/ACLs/memberships/default privileges parcialmente modelados. C) RLS/policies: cobertos. D) Roles/permissões: cobertos com credenciais sintéticas. E) Funções/triggers: nenhum no inventário público.

**Não substituídas migrations históricas; `prisma/schema.prisma` oficial não alterado.** (**PASS**)

## 6. Policies e RLS
| Verificação | Resultado |
|---|---|
| RLS ON/OFF match | 0 diferenças (0 esperado) |
| Contagem policies | 47 (lab) |
| Diferenças textuais policies (sample JSON) | 0 |
| Tabelas sem RLS (intencional) | `Account,EmailActionToken,Session,VerificationToken` iguais |

**PASS** (estado RLS/contagem). Semântica exaustiva por policy: **NOT PROVEN**.

## 7. Roles e grants
| Item | Resultado |
|---|---|
| Roles `mf_*`/suporte com atributos NOBYPASSRLS/NOINHERIT/LOGIN espelhados (sintéticas) | PASS |
| Memberships postgres→mf executores | PASS |
| Grants `mf_*` por tabela (de `role_table_grants`) | PASS (geração/aplicação) |
| Default privileges completos / grants implícitos Supabase-specific | NOT PROVEN |
| service_role/anon/authenticated semântica Supabase | NOT PROVEN (lab Docker ≠ Supabase) |

## 8. Comparação origem / reconstrução
| Métrica | Origem 5437 | Lab 5440 | Estado |
|---|---:|---:|---|
| Tabelas base | 51 | 51 | PASS |
| Missing / Extra | — | — | {"missing":[],"extra":[]} |
| RLS diff | — | — | PASS |
| Colunas (count snapshot) | 520 | 520 | PASS (contagem) |
| PK diffs | — | — | PASS |
| FK diffs (normalizado) | 93 | 93 | FAIL |
| UNIQUE diffs | — | — | PASS |
| Index diffs (def sample) | — | — | PASS |
| Policy diffs (sample) | — | — | PASS |

## 9. Testes de isolamento (lab, NOBYPASSRLS)
Fixtures sintéticas: tenants `ta/tb`, users `ua/ub`, customers `ca/cb`. GUCs `app.tenant_id/app.user_id/app.is_admin`; roles `mf_app_nobypass` e `mf_admin_executor`.

| Teste | Resultado |
|---|---|
| Tenant A vê A (1), não vê B (0), total visível = 1 | **PASS** |
| Tenant B vê B (1), não vê A (0) | **PASS** |
| Sem tenant (vazio) vê 0 | **PASS** |
| A UPDATE B: 0 linhas afectadas | **PASS** |
| A INSERT em tenant B: RLS violation (policy `Customer`) | **PASS** |
| Admin executor (`app.is_admin=true`) vê total (2) | **PASS** |

**Limitação:** amostral (`Customer` + `AuthJwtRevocation`). Não prova todas as 47 tabelas/policies/rotas. **NOT PROVEN** exaustivo.

## 10. Compatibilidade Prisma
| Item | Resultado |
|---|---|
| `npx prisma validate --schema prisma/schema.prisma` | **PASS** (warnings `onDelete SetNull` preexistentes noutras relações) |
| Correspondência Prisma schema ↔ estrutura real origem | **NOT PROVEN** (drift 1B/1C) |
| Cadeia Prisma Migrate a partir do baseline em 5437 | **NOT EXECUTED** (proibido) |
| `prisma migrate diff` / futuras migrations sem recriar existentes | **NOT EXECUTED / NOT PROVEN** |
| RLS/roles sobrevivem ao fluxo Prisma | **NOT PROVEN** |

## 11. Testes da migration JWT (lab apenas)
Migration: `prisma/migrations/20261105233000_auth_jwt_revocation_phase1/migration.sql` — **NÃO APLICADA em 5437**.

| Item | Resultado |
|---|---|
| Aplicação no lab (baseline + roles) | **PASS** (CREATE TABLE/INDEX, RLS/FORCE, policies, REVOKE/GRANT) |
| Tabela existe, RLS ON/FORCE ON, 3 policies | **PASS** |
| FK→`User(id)` compatível; roles dependentes existem | **PASS** |
| Isolamento: A insere própria (1); A inserir como B bloqueado RLS; B não vê A (0); admin vê (1) | **PASS** (amostral) |
| Nota | Primeira tentativa falhou por `pgcrypto` ausente no script de teste (`digest`); extensão criada/removida só no lab. O SQL da migration **não depende** de `pgcrypto`. |

## 12. Divergências
- Origem 5437: `_prisma_migrations` ausente; divergências migrations↔schema real (1B/1C) — **DRIFTED/NOT PROVEN**. Não resolvidas.
- Dump UTF-16LE por redirecção PowerShell — corrigido na restauração; pipeline futuro deve forçar UTF-8 directo.
- `05-rls-roles-grants.sql` falhou parcialmente na 1ª aplicação por policy já existente; versão idempotente criada. Estado final: 47 policies.
- Drift colunas origem vs Prisma histórico: **NOT PROVEN/DRIFTED**.

## 13. Limitações
- Schema-only; sem dados reais/volumetria/validação dependente de dados.
- Lab Docker ≠ Supabase (anon/authenticated/service_role).
- Grants/default privileges/SECURITY DEFINER/owners: **NOT PROVEN** exaustivos.
- Prisma migrate/shadow/diff: **NOT EXECUTED**.
- Isolamento amostral (`Customer`, `AuthJwtRevocation`).
- Causa ausência `_prisma_migrations`: **NOT PROVEN**.

## 14. Riscos residuais
- Baseline pode omitir objectos/ACLs não inventariados — **ALTO** até inventário/ensaio completo.
- Baseline/histórico Prisma em 5437 continua arriscado — **ALTO**.
- Aplicação isolada migration JWT em 5437: aditiva mas sem rastreabilidade Prisma e sem backup externo verificado nesta fase — **MÉDIO/ALTO** operacional.
- Gap stale-JWT não mitigado — **ALTO**.

## 15. Ficheiros experimentais criados
- `tmp/jwt-revocation-baseline-lab/origin/*` (inventory, dumps, policies-grants, erros)
- `tmp/jwt-revocation-baseline-lab/artifacts/*` (security SQL, roles/grants/policies candidatos)
- `tmp/jwt-revocation-baseline-lab/lab/*` (scripts, SQL fixtures/isolation/jwt, logs)
- `tmp/jwt-revocation-baseline-lab/evidence/*` (snapshots, compare, fk-diff)
- `JWT_REVOCATION_PHASE_1D_BASELINE_VALIDATION.md`

Nenhum artefacto em migrations oficiais; `prisma/schema.prisma` e código auth não alterados.

## 16. Confirmação: 5437 não recebeu escritas
- Criação/restauração/RLS/grants/testes direccionados a `127.0.0.1:5440/mf_rls_baseline_lab` (`mf_rls_baseline_lab_5440`).
- Origem 5437: apenas SELECT/pg_dump/inventário.
- Verificação final origem: `AuthJwtRevocation=null, _prisma_migrations=null, tables=51`. (**PASS**)
- Sem migrate deploy/dev/resolve/reset/db push, sem DDL/DML na origem. (**PASS**)

## 17. Recomendação para a Fase 1E
**Estado global 1D: PARTIAL** — reconstrução estrutural + RLS/roles/grants candidatos + isolamento amostral + migration JWT validados no lab; staging original intacta. **Não PASS completo** (equivalência Prisma/histórico, grants/default privileges/segurança completa e cobertura RLS exaustiva: **NOT PROVEN/NOT EXECUTED**).

**Fase 1E (nova autorização explícita):**
1. Inventário exaustivo colunas/tipos/defaults/índices/FKs/policies/ACLs/default privileges (diff detalhado origem vs lab vs Prisma schema).
2. Pipeline dump determinístico UTF-8 directo; baseline reproduzível versionado (fora de migrations oficiais até aprovação).
3. Estratégia formal Prisma Migrate (A): separar Prisma vs SQL operacional (RLS/roles/grants); testar em cópia descartável, **nunca 5437 sem plano aprovado**.
4. Só após plano 1E aprovado + backup externo verificado: considerar aplicação controlada migration JWT em 5437 (1F) ou integração ao baseline, com rastreabilidade/rollback. **Não avançar para 1E/Fase 2 sem autorização.**

**NÃO produção pronta. NÃO avançar para Fase 2 de revogação JWT.**