# JWT_REVOCATION_PHASE_1E_PRISMA_SECURITY_VALIDATION

**Date:** 2026-11-05  
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch:** `wms-v2-e2e-staging`  
**Scope:** validação **exclusiva em laboratório** `127.0.0.1:5440/mf_rls_baseline_lab` (+ bases descartáveis `mf_rls_baseline_lab2`, `mf_rls_shadow_1e`). **Staging original 5437 somente leitura.**

## 1. Estado inicial do Git
| Item | Resultado |
|---|---|
| Branch | `wms-v2-e2e-staging` (**PASS**) |
| `git status --short` antes | Worktree preexistente pesado preservado. (**PASS**) |
| `git status --short` depois | Inalterado + untracked `tmp/jwt-revocation-baseline-lab/phase-1e/`, `JWT_REVOCATION_PHASE_1E_PRISMA_SECURITY_VALIDATION.md`. (**PASS**) |
| `.env/.env.local`, `prisma/schema.prisma`, migrations oficiais, código auth | **não alterados** (**PASS**) |
| Commits/push/merge/deploy/reset/clean | **nenhum** (**PASS**) |

## 2. Estado do laboratório (preservado)
| Item | Valor | Classificação |
|---|---|---|
| Container | `mf_rls_baseline_lab_5440` `postgres:17` Up | PASS |
| Porta | `0.0.0.0:5440->5432` (≠5437/5436) | PASS |
| DB original lab | `mf_rls_baseline_lab` (52 tabelas; inclui `AuthJwtRevocation` da 1D) | PASS |
| Volume | `mf_rls_baseline_lab_5440_data` dedicado | PASS |
| Versão | PostgreSQL 17.11 Debian | PASS |
| Concorrência aparente | não detectada | PASS (NOT PROVEN exaustivo) |
| Lab original apagado? | **Não** | PASS |

## 3. Backup e recuperação
- Backup externo lab: `pg_dump --format=custom` → `tmp/jwt-revocation-baseline-lab/phase-1e/backup/lab1.backup` (236468 bytes). (**PASS** criação; restore **NOT EXECUTED**)
- Bases descartáveis isoladas: `mf_rls_baseline_lab2`, `mf_rls_shadow_1e`. (**PASS**)
- Recuperação conceptual: `pg_restore` em DB descartável nova; preservar volume até revisão; destruir apenas descartáveis após autorização. (**NOT PROVEN** por restore real)


## 4. Baseline candidato (phase-1e, não oficial)
Local: `tmp/jwt-revocation-baseline-lab/phase-1e/chain-candidate/`
- `001_baseline_candidate.sql` — dump schema-only UTF-8 origem 5437 (1D).
- `002_rls_roles_grants_candidate.sql` — roles sintéticas + memberships + grants `mf_*` + RLS/policies idempotentes.
- `003_auth_jwt_revocation_candidate.sql` — cópia da migration JWT oficial (teste).
- Cadeia oficial `prisma/migrations/*` e `prisma/schema.prisma`: **não alteradas**. (**PASS**)

## 5. Testes Prisma Migrate
| Teste | Resultado | Nota |
|---|---|---|
| A. Reconstruir 2ª base vazia (`lab2`) a partir do baseline candidato | **PASS** | 51 tabelas, 47 policies, 47 RLS ON (`rebuild-lab2*.log`). |
| B. Inicializar histórico Prisma controlado na 2ª base | **NOT EXECUTED / BLOCKED** | Requer `migrate resolve`/metadados; proibido e arriscado com drift. |
| C. `prisma migrate status` | **NOT EXECUTED** | Evitado por risco de alvo/ambiguidade. |
| D. `prisma migrate diff --from-url lab2 --to-schema-datamodel prisma/schema.prisma --script` | **PASS (execução)** / **FAIL (equivalência)** | `evidence/migrate-diff-lab2-to-schema.sql` (13360 bytes): **2 DropForeignKey, 8 DropIndex, 29 CreateIndex, 1 CreateTable `AuthJwtRevocation`**. |
| E. Tentativa de recriar/eliminar/alterar indevidamente? | **FAIL** (baseline-as-is vs schema Prisma worktree) | Diff sugere drops/recreates de FKs/índices; não alinhado. Não aplicar. |
| F/G. Simular migration aditiva futura | **NOT EXECUTED / BLOCKED** | Diff não limpo; cadeia oficial intocável; histórico não reconciliado. |

## 6. Resultado migrate diff (resumo)
- Drop FKs: `StockMovement.tenantId_fkey`, `Warehouse.tenantId_fkey` (**alto risco se aplicado**).
- Drop índices (8): `BusinessDocument_tenantId_type_number_key`, `BusinessDocument_tenantId_type_status_issueDate_idx`, `EmailActionToken_userId_purpose_expiresAt_idx`, `EmailCampaign_status_scheduledAt_idx`, `EmailCampaignRecipient_campaignId_status_createdAt_idx`, `EmailDelivery_status_createdAt_idx`, `PlatformTeamInvite_email_status_idx`, `PlatformTeamInvite_status_expiresAt_idx`.
- Create: `AuthJwtRevocation` + 4 índices próprios + 29 `CREATE INDEX` adicionais.
- **Conclusão:** demonstra **não-equivalência** DB↔schema Prisma. `migrate diff` útil mas não prova segurança; `migrate status` isolado insuficiente. **NOT PROVEN compatibilidade Prisma Migrate**.

## 7. Simulação de migration futura
**NOT EXECUTED / BLOCKED.** Diff não limpo impediria simulação fiável; gerar SQL pode introduzir Drop* inesperados.

## 8. Comparação estrutural (5437 read-only vs labs; lab1 exclui `AuthJwtRevocation` da 1D)
| Dimensão | origem vs lab1 | origem vs lab2 | Classificação |
|---|---|---|---|
| Tabelas | 0/0/0 | 0/0/0 | PASS |
| Colunas | 0/0/0 | 0/0/0 | PASS |
| PKs | 0/0/0 | — | PASS |
| FKs (normalizado) | 0/0/0 | — | PASS |
| UNIQUEs | 0/0/0 | — | PASS |
| Índices (definição) | 0/0/0 | — | PASS |
| Policies | 0/0/0 | 0/0/0 | PASS |
| Grants `mf_*` | 0/0/0 | 0/0/0 | PASS |
| Defaults/tipos/nullability exaustivos vs Prisma model | — | — | NOT PROVEN |
| Equivalência semântica/Prisma | — | — | **FAIL / NOT PROVEN** |

## 9. Testes RLS (lab1, NOBYPASSRLS, fixtures sintéticas)
| Cenário | Resultado |
|---|---|
| Tenant A só consulta próprios (Customer/Product/Invoice/InvoiceItem/Warehouse/StockMovement/StockAdjustment/PurchaseOrder) | **PASS** |
| Tenant B só consulta próprios | **PASS** (amostral) |
| A não consulta B | **PASS** |
| A não altera B (UPDATE) | **PASS** (0 rows) |
| A não elimina B (DELETE) | **PASS** (0 rows) |
| INSERT cross-tenant rejeitado | **PASS** (Customer RLS violation) |
| Sem tenant sem acesso indevido | **PASS** (0 rows domínios testados) |
| Alteração manual `app.tenant_id` | **PASS** (RLS usa valor efectivo; não testa confusão de identidade app) |
| Role normal assume `app.is_admin=true` e contorna RLS? | **FAIL (vulnerabilidade ALTA, desenho)** — `mf_app_nobypass` (NOBYPASSRLS) executou `set_config('app.is_admin','true',false)` e viu todos Customers (2). `REVOKE SET ON PARAMETER app.is_admin` **não impediu** no teste. |
| Role normal operações admin fora de grants | **PARTIAL / NOT PROVEN** |
| Admin executor (`mf_admin_executor` + `app.is_admin=true`) | **PASS** (amostral) |
| Escritas não autorizadas bloqueadas | **PASS** (amostrais) |

## 10. Testes administrativos
| Teste | Resultado |
|---|---|
| Fronteira `app.is_admin` GUC com role de aplicação | **FAIL** — GUC setável; policies `current_setting('app.is_admin',true)='true'` satisfazíveis. |
| Mitigação `REVOKE SET ON PARAMETER app.is_admin` | **FAIL** (não efectiva no teste). |
| Implicação | `app.is_admin` **não é barreira confiável** sob sessão/role comprometida ou mal isolada. Requer defesa em profundidade (função `SECURITY DEFINER` controlada para `SET LOCAL`, GUC custom com controlo estrito, ou separação de roles/claims server-side). **Não alterado.** |

## 11. Testes AuthJwtRevocation (lab1)
| Teste | Resultado |
|---|---|
| RLS ENABLE + FORCE RLS | **PASS** |
| Unicidade `jtiHash` | **PASS** (duplicate key) |
| Isolamento A/B (select) | **PASS** (B vê 0) |
| Inserção própria (`userId=app.user_id`) | **PASS** |
| Self UPDATE/DELETE | **PASS** (`permission denied`) |
| Consulta `jtiHash` de outros | **PASS** |
| Manipulação `reason` pelo utilizador (`admin_action_forged`) | **FAIL (MÉDIA, integridade/auditoria)** — `ajr_self_insert` valida só `userId`. |
| Manipulação `actorUserId` pelo utilizador | **FAIL (MÉDIA)** — insert aceitou `actorUserId` de outro utilizador. |
| `tenantIdAtIssue`/`metadata` controlados? | **NOT PROVEN / risco** (policy não restringe). |
| Idempotência aplicacional / expiração / cleanup | **NOT PROVEN** (depende serviço). |
| Privilégios mínimos serviço central | **NOT PROVEN** — self-insert deve ser restringido ou mediado por executor dedicado. |

## 12. Vulnerabilidades encontradas
1. **VULN-1 ALTA (RLS/GUC):** role aplicação pode setar `app.is_admin=true` e satisfazer policies admin. Mitigação testada ineficaz.  
2. **VULN-2 MÉDIA (auditoria AuthJwtRevocation):** self-insert permite forjar `reason`/`actorUserId`/campos não vinculados.  
3. **VULN-3 MÉDIA/ALTA (migração):** diff sugere Drop FKs/índices; aplicar sem reconciliação pode danificar estrutura.

## 13. Divergências
- Baseline candidato (origem) vs `prisma/schema.prisma` worktree: desalinhados (JWT ausente no baseline; índices/FKs divergem no diff).
- 5437 sem `_prisma_migrations`; 24 migrations vs estado real: **DRIFTED/NOT PROVEN**.
- Policies assumem controlo aplicacional de GUCs — assunção insegura se GUC setável pela role.

## 14. Resultados de regressão
| Teste | Resultado |
|---|---|
| `npx prisma validate` | **PASS** (warnings `SetNull` preexistentes) |
| `npx tsc --noEmit -p tsconfig.json` | **PASS** |
| Testes RLS repo existentes | **NOT EXECUTED** |
| Isolamento multi-tenant SQL (lab) | **PASS** (amostral) |
| Integridade migration JWT | **PARTIAL** (estrutura/RLS/unique PASS; auditoria campos **FAIL**) |

## 15. Limitações
- RLS/SQL amostral; não cobre todas tabelas/rotas HTTP/adapters/transações.
- Prisma migrate status/histórico reconciliado: **NOT EXECUTED**.
- Restore do backup: **NOT EXECUTED**.
- Grants/default privileges/owners/SECURITY DEFINER exaustivos: **NOT PROVEN**.
- Migration aditiva futura simulada: **NOT EXECUTED/BLOCKED**.

## 16. Riscos residuais
- Bypass `app.is_admin` via GUC: **ALTO**.  
- Auditoria revogação forjável em campos: **MÉDIO**.  
- Baseline/migrate sem reconciliação: **ALTO**.  
- Stale-JWT gap não mitigado: **ALTO**.

## 17. Recomendação para a próxima fase
**Fase 1E: FAIL/BLOCKED** para PASS completo (compatibilidade Prisma Migrate não demonstrada; `app.is_admin` bypassável; integridade auditoria self-insert insuficiente). **Não avançar para 1F/Fase 2 sem autorização explícita.**

1. **Desenho segurança (bloqueante):** substituir/defender `app.is_admin` (função `SECURITY DEFINER` controlada + `SET LOCAL`/GUCs não user-settable, ou claims/roles server-side). Testar no lab.  
2. **Endurecer `AuthJwtRevocation`:** restringir self-insert (trigger/CHECK/policy/colunas permitidas ou mediação por executor) para `reason/actorUserId/metadata` controlados; manter append-only.  
3. **Reconciliar baseline↔Prisma schema:** snapshot fiel A incluindo índices/FKs/JWT; limpar diff até sem Drop* inesperado; testar histórico Prisma controlado só em DB descartável.  
4. **1F (se autorizado):** só após 1–3 + backup externo verificado + rollback; aplicar migration JWT em 5437 por caminho aprovado.  

## 18. Conformidade de limites
- 5437 **somente leitura**; verificação final `{"ajr":null,"pm":null,"t":51}`. (**PASS**)  
- Sem 5436/Supabase/produção; sem alterações `.env*`/`prisma/schema.prisma`/migrations oficiais/código auth. (**PASS**)  
- Artefactos em `tmp/jwt-revocation-baseline-lab/phase-1e/`. Labs 5440 preservados. (**PASS**)  

**NÃO avançar para Fase 1F nem Fase 2. Produção fora do âmbito.**