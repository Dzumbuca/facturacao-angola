# JWT_REVOCATION_PHASE_1F_PRISMA_BASELINE_RECONCILIATION

**Date:** 2026-11-06  
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch:** `wms-v2-e2e-staging` (commit `95e00366` observed at start)  
**Scope:** Fase 1F — reconciliação estrutural Prisma↔PostgreSQL (VULN-3), **exclusivamente em laboratório** `127.0.0.1:5440` (PostgreSQL 17.11, role `postgres`) e bases descartáveis novas/existentes 5440. **`127.0.0.1:5437/mf_rls_staging` READ-ONLY** — nenhuma escrita/DDL/DML dirigida a 5437 (credencial `postgres` 5437 não validada aqui; nenhuma operação tentada). Sem 5436/Supabase/produção. **Sem alterações** em `.env`/`.env.local`, `prisma/schema.prisma` oficial, migrations oficiais, código aplicação/Auth/NextAuth. Sem commits/push/merge/deploy/reset/clean/DROP/TRUNCATE em bases de origem. VULN-1/VULN-2: apenas regressão verificada; implementações aprovadas não alteradas.

## 1. Estado inicial
| Item | Resultado | Classificação |
|---|---|---|
| Branch/commit | `wms-v2-e2e-staging` / `95e00366` | **PASS** |
| `git status --short` antes | Worktree preexistente pesado preservado (M/?? conforme remediação). | **PASS (preservado)** |
| `git status --short` depois | Inalterado; novos untracked apenas `tmp/jwt-revocation-baseline-lab/phase-1f/*` e este relatório. | **PASS** |
| Relatórios 1D/1E/remediação | Inspecionados (contexto/artefactos existentes). | **PASS** |
| Backups existentes | `remediation/backup/lab1_pre_remediation.backup`, `remediation/backup/remed_v2c.backup`, `phase-1e/backup/lab1.backup` (não removidos). | **PASS** |
| PG 17.11 @ 5440 | Confirmado em `postgres`, `mf_rls_baseline_lab2`, `mf_rls_remed_v4`, `mf_rls_remed_v5`, `mf_rls_phase1f_v1`. | **PASS** |
| Bases referência (não alteradas destrutivamente) | `mf_rls_baseline_lab`, `mf_rls_baseline_lab2`, `mf_rls_remed_v4`, `mf_rls_remed_v5` preservadas; novas descartáveis `mf_rls_phase1f_v1`, `mf_rls_phase1f_v1_ajr`, `mf_rls_phase1f_rebuild`. | **PASS** |

## 2. Ambiente utilizado
- PostgreSQL 17.11 (Debian) `127.0.0.1:5440`, role `postgres` (lab). Node/pg via `facturacao-angola/node_modules/pg`. Prisma CLI via `npx prisma` no repo (sem `--from-migrations`; diffs por `--from-url ... --to-schema-datamodel prisma/schema.prisma`).
- Inventário: `tmp/jwt-revocation-baseline-lab/phase-1f/inventory/db-inventory.json`, `phase1f_v1-fks/indexes/constraints/columns.json`.
- Evidência: `tmp/jwt-revocation-baseline-lab/phase-1f/evidence/*`, `analysis/index-ajr-evidence.json`, `analysis/vuln3-classification.json`.

## 3. Backups
| Backup | Local | Ação 1F |
|---|---|---|
| lab1_pre_remediation.backup | remediation/backup | Preservado, não restaurado (**NOT EXECUTED**) |
| remed_v2c.backup | remediation/backup | Preservado |
| phase-1e lab1.backup | phase-1e/backup | Preservado |
| Novas bases 1F | templates 5440 descartáveis | Não é backup de 5437; apenas isolamento lab (**PASS**) |

## 4. Inventário estrutural (referência `mf_rls_phase1f_v1` = template `mf_rls_baseline_lab2`)
| Métrica | Valor | Classificação |
|---|---|---|
| Tabelas base públicas | 51 (`lab1` 52 com AJR) | **PASS (inventariado)** |
| Colunas | 520 | **PASS** |
| PK/UNIQUE constraints | 51 | **PASS** |
| FKs | 93 | **PASS** |
| Índices | 169 | **PASS** |
| Policies | 47 (baseline app.is_admin) | **PASS** |
| RLS ON / FORCE RLS | 47 / 0 (baseline) | **PASS** |
| `_prisma_migrations` | ausente | **NOT PROVEN / histórico divergente** |
| `AuthJwtRevocation` (em lab2/phase1f_v1) | ausente | **PASS (facto)** |

## 5. Fase B — Foreign keys (2 divergências prioritárias)
Fonte: `phase1f_v1` (proxy 5437 schema). Comparação com diff Prisma (`evidence/migrate-diff-phase1f_v1_ajr-to-schema.sql`).

| FK | PostgreSQL real (lab/5437 proxy) | Prisma schema esperado (diff) | Colunas | Ref | ON UPDATE | ON DELETE DB | ON DELETE schema/diff | DEFERRABLE | Integridade dados (phase1f_v1) | Dependências/impacto | Origem provável | Recomendação | Classificação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `StockMovement_tenantId_fkey` | `FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE` | diff: DROP + ADD `ON DELETE RESTRICT ON UPDATE CASCADE` (schema omite `onDelete` em `tenant Tenant @relation(fields:[tenantId],references:[id])`) | `tenantId` | `Tenant.id` | CASCADE | **CASCADE** | **RESTRICT** | NOT DEFERRABLE | `StockMovement=0,Tenant=0` (base vazia); integridade real 5437 **NOT PROVEN** | Tenant delete em CASCADE apaga movimentos (perda histórico operacional/financeiro/auditoria). RESTRICT preserva histórico mas pode bloquear eliminação de tenant; exige fluxo de retenção/anonimização. Multi-tenant: ambos mantêm `tenantId`; risco é comportamental. | Schema Prisma não modela cascade explícito; DB recebeu cascade (migração/manual/histórico). | **DECISION REQUIRED.** Não aplicar automaticamente. Recomendo **RESTRICT** (ou NO ACTION) para histórico financeiro/stock, **somente** após decisão de produto + migração de dados/fluxo de delete tenant + teste em cópia com dados reais representativos. | **DECISION REQUIRED** |
| `Warehouse_tenantId_fkey` | `FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE` | diff: DROP + ADD `ON DELETE RESTRICT ON UPDATE CASCADE` | `tenantId` | `Tenant.id` | CASCADE | **CASCADE** | **RESTRICT** | NOT DEFERRABLE | `Warehouse=0,Tenant=0` | Cascata remove armazéns e pode afetar stock/movimentos ligados; RESTRICT protege estrutura mas altera delete tenant. | Mesma divergência schema↔DB. | **DECISION REQUIRED.** Mesma cautela; avaliar ordem de dependências (StockMovement/Warehouse/ProductWarehouseStock etc.). | **DECISION REQUIRED** |

**Achados adicionais (não solicitados mas críticos no diff):** Prisma propõe também `RenameForeignKey` `StockMovement_tenant_product_fkey`→`StockMovement_tenantId_productId_fkey` (definição funcionalmente equivalente, RESTRICT/CASCADE preservado — **baixo risco**, mas exige validação de nome em dependências) e 7 `AddForeignKey` (composite tenant-scoped: `ProductWarehouseStock_tenantId_warehouseId_fkey`, `PurchaseReception_tenantId_warehouseId_fkey`, `StockMovement_reversalOfId/purchaseReceptionId/transferId/transferReceptionId/warehouseId` composite). Em `phase1f_v1` **esses FKs não existem** — adicioná-los é aditivo e melhora integridade multi-tenant **se dados forem compatíveis**; **NOT EXECUTED** (requer validação de órfãos/cross-tenant em 5437 read-only + aplicação autorizada). **NOT PROVEN safe sem dados reais.**

## 6. Fase C — Índices

### 6.1 Oito `DropIndex` (diff)
Dados: `analysis/index-ajr-evidence.json` / `inventory/phase1f_v1-indexes.json`. Nenhum drop executado.

| # | Nome | Tabela | DB definição (resumo) | Schema/diff intenção | Semântica/impacto | Classificação |
|---|---|---|---|---|---|---|
| 1 | `BusinessDocument_tenantId_type_number_key` | `BusinessDocument` | UNIQUE btree(`tenantId`,`type`,`number`) | schema tem `@@unique([tenantId,number])` e diff cria `BusinessDocument_tenantId_number_key` (sem `type`) | **Mudança de unicidade**: DB atual permite mesmo `number` em `type` diferente no tenant; schema propõe unicidade por `number` global no tenant. Impacto funcional alto em numeração de documentos. | **DECISION REQUIRED** (divergência schema vs regra de negócio) |
| 2 | `BusinessDocument_tenantId_type_status_issueDate_idx` | `BusinessDocument` | INDEX(`tenantId`,`type`,`status`,`issueDate`) | schema tem `@@index([tenantId,issueDate])`, `@@index([customerId,issueDate])` | Índice de consulta/status removido; possível regressão de performance. | **DECISION REQUIRED** |
| 3 | `EmailActionToken_userId_purpose_expiresAt_idx` | `EmailActionToken` | INDEX(`userId`,`purpose`,`expiresAt`) | schema `@@index([userId,expiresAt])` (sem `purpose`) | Perde filtro por purpose; possível impacto em limpeza/lookup. | **DECISION REQUIRED** |
| 4 | `EmailCampaign_status_scheduledAt_idx` | `EmailCampaign` | INDEX(`status`,`scheduledAt`) | schema `@@index([scheduledAt])` | Perde seletividade por status. | **DECISION REQUIRED** |
| 5 | `EmailCampaignRecipient_campaignId_status_createdAt_idx` | `EmailCampaignRecipient` | INDEX(`campaignId`,`status`,`createdAt`) | schema `@@index([campaignId,createdAt])` | Perde status no índice. | **DECISION REQUIRED** |
| 6 | `EmailDelivery_status_createdAt_idx` | `EmailDelivery` | INDEX(`status`,`createdAt`) | schema já tem `tenantId/invoiceId/purpose/createdAt` indexes; status index removido | Possível impacto em filas/status queries. | **DECISION REQUIRED** |
| 7 | `PlatformTeamInvite_email_status_idx` | `PlatformTeamInvite` | INDEX(`email`,`status`) | schema `@@index([email])` | Perde status. | **DECISION REQUIRED** |
| 8 | `PlatformTeamInvite_status_expiresAt_idx` | `PlatformTeamInvite` | INDEX(`status`,`expiresAt`) | schema `@@index([expiresAt])` | Perde status. | **DECISION REQUIRED** |

### 6.2 Vinte e nove `CreateIndex` (diff total AJR excluída na leitura bruta; diff pós-AJR mostra **22 CreateIndex** restantes)
Classificação por evidência (nomes/defs em `migrate-diff-*-to-schema.sql` + inventário):

| Grupo | Exemplos | DB atual | Classificação | Observação |
|---|---|---|---|---|
| Aditivos ausentes | `BusinessDocument_tenantId_id_key`, `BusinessDocument_tenantId_number_key` (schema), `BusinessDocumentCounter_tenantId_idx`, `Product_tenantId_idx`, `Product_codigo_idx`, SM `warehouseId/transferId/purchaseReceptionId/transferReceptionId/reversalOfId/createdAt` e uniques tenant-scoped compostos | maior parte ausente | **LEGITIMATE ADDITIVE (candidato)**, **NOT PROVEN safe/perf** | Podem reforçar integridade/performance; validar colunas/dados/locks/tempo antes de aplicar em staging. Alguns conflitam semanticamente com drops (#1). |
| Nome/definição diferente | `Product_tenantId_barcode_key` (DB tem **partial** `WHERE (barcode IS NOT NULL)`; diff pede unique plain) | **existe com semântica diferente** | **DECISION REQUIRED** (caso especial 6.3) | Não substituir automaticamente. |
| Já existentes equivalentes? | `StockMovement_tenantId_id_key`, `Warehouse_tenantId_idx` existem | presentes | **NOT A DIFF ISSUE / verify** | diff pós-AJR ainda pede creates? resumo contou creates; alguns podem ser por def/name mismatch — requer revisão linha-a-linha antes de aplicar. **NOT PROVEN**. |
| SM uniques compostos (`idempotencyKey`, `transferReceptionId`, `reversalOfId` por tenant) | ausentes em lab2 | aditivos | **LEGITIMATE ADDITIVE**, **NOT PROVEN** | Dependem de colunas existentes (presentes) e de ausência de duplicados; validar em 5437 read-only. |

### 6.3 Caso especial — `Product_tenantId_barcode_key`
| Aspecto | DB (phase1f_v1/proxy 5437) | Schema Prisma / diff | Análise |
|---|---|---|---|
| Definição | `CREATE UNIQUE INDEX "Product_tenantId_barcode_key" ON "Product"(tenantId,barcode) WHERE (barcode IS NOT NULL)` | `@@unique([tenantId,barcode])` → diff: `CREATE UNIQUE INDEX ... (tenantId,barcode)` sem predicate | Semântica: Postgres unique permite múltiplos NULLs em coluna nullable; partial WHERE barcode IS NOT NULL também permite múltiplos NULLs e **inclui** `''` (string vazia, não NULL) na unicidade. Schema plain unique também permite múltiplos NULLs e inclui `''`. Diferença prática pequena para NULLs, mas predicate explicita intenção e pode interagir com planner/migrações; trocar para plain unique **pode falhar** se existirem duplicados `('' , tenant)` ou estados não previstos? `phase1f_v1` tem 0 produtos (NOT PROVEN em 5437). |
| Regras funcionais | **NOT PROVEN** sem código/5437 | barcode opcional | Validar aplicação: barcode vazio vs NULL; imports; scans. |
| Dados 5437 | **NOT EXECUTED** (5437 read-only, sem credencial aqui) | — | Requer `count(*) filter (barcode is null)`, duplicados por tenant, vazios. |
| Recomendação | **Preservar índice partial existente** até prova de equivalência com dados 5437 e decisão de modelagem Prisma (`@@unique` não expressa predicate parcial em Prisma padrão; pode exigir raw SQL/migração custom gerida fora ou ajuste aceito). | — | **DECISION REQUIRED** |

## 7. Fase D — `AuthJwtRevocation`
| Item | Migration oficial `20261105233000...` | `mf_rls_baseline_lab` (lab1) | Candidato `mf_rls_phase1f_v1_ajr` / `rebuild` | Classificação |
|---|---|---|---|---|
| Tabela/PK/unique `jtiHash` | CREATE TABLE + PK + UNIQUE | Presente | Presente (aplicação aditiva da migration em DB descartável) | **PASS** |
| Índices | `userId,revokedAt`; `expiresAt`; `userId,expiresAt` | Presentes | Presentes | **PASS** |
| FKs | `userId->User` CASCADE, `actorUserId->User` SET NULL | Presentes | Presentes | **PASS** |
| RLS/FORCE RLS | ENABLE + FORCE | ON/FORCE ON | ON/FORCE ON | **PASS** |
| Policies (migration) | `ajr_admin_all` (app.is_admin GUC), `ajr_self_select`, `ajr_self_insert` | app.is_admin/self_insert presentes | migration aplica baseline; hardening operacional VULN-2 substitui por `ajr_jwt_writer_insert` + remove self_insert/direct | **PASS (candidato com hardening separado)** |
| Grants | SELECT/INSERT `mf_app_nobypass`,`mf_admin_executor`; SELECT/INSERT/DELETE `mf_migration` | presentes | reconciliados no hardening (app path SELECT-only AJR; funções controlam insert) | **PASS (lab)** |
| Funções associadas | n/a na migration oficial | n/a | VULN-2: `mf_revoke_jwt_self/admin` validadas (Phase H) | **PASS (lab)** |
| Divergência CreateTable no diff | Aparece em `phase1f_v1` (sem AJR) | — | **Não aparece** em `phase1f_v1_ajr/rebuild` | **PASS (representação estrutural)** |
| Causa provável | Baseline proxy sem AJR / ordem de construção; não é duplicação | — | — | **NOT PROVEN** (histórico 5437) |

**Conclusão D:** AJR está corretamente representada por aplicação aditiva da migration oficial em DB descartável. **Não duplicar/remover políticas, funções ou grants validados.**

## 8. Fase E — Baseline candidata (reproduzível, separada)
Local: `tmp/jwt-revocation-baseline-lab/phase-1f/`.

### Prisma-managed (candidato, aditivo / classificado)
- Estrutura base: clone controlado de `mf_rls_baseline_lab2`/`phase1f_v1` (proxy 5437 schema). **Sem drops.**
- AJR: aplicação aditiva de `prisma/migrations/20261105233000_auth_jwt_revocation_phase1/migration.sql` (BOM removido apenas na cópia lida em runtime do script; ficheiro oficial **não alterado**). Resultado: `mf_rls_phase1f_v1_ajr`.
- Diferenças Prisma restantes **não aplicadas** (FK cascade/restrict, 8 drops, creates/renames/add FKs): classificadas como DECISION REQUIRED/LEGITIMATE ADDITIVE NOT PROVEN.

### Operacional PostgreSQL (separado)
- VULN-1: `mf_is_admin_executor()` + substituição policies `app.is_admin`→`mf_is_admin_executor()`. Candidato: `tmp/jwt-revocation-baseline-lab/remediation/candidate/v4-vuln1-vuln2-reconciled.sql` (artefacto tmp; corrigido para substituição literal robusta durante 1F).
- VULN-2: `mf_jwt_writer`, hardening AJR policies/grants, `mf_revoke_jwt_self/admin` SECURITY DEFINER com `search_path` fixo e ownership dedicada.
- Roles/memberships/grants completos de produção: **NOT PROVEN**.

## 9. Fase F — Validação Prisma
| Comando | Alvo | Resultado | Classificação |
|---|---|---|---|
| `npx prisma validate` | schema oficial | **PASS** (válido; warnings `SetNull` preexistentes) | **PASS** |
| `prisma migrate diff --from-url phase1f_v1 --to-schema-datamodel schema.prisma` | base sem AJR | DropFK 2, DropIndex 8, CreateTable AJR 1, CreateIndex 22, RenameFK 1, AddFK 9 (ver `evidence/migrate-diff-phase1f_v1-to-schema.sql`; resumo por script 07/19; encoding UTF-16 no ficheiro tee — conteúdo presente) | **FAIL (não limpo/destrutivo/decisões pendentes)** |
| `prisma migrate diff --from-url phase1f_v1_ajr --to-schema-datamodel schema.prisma` | candidato com AJR | DropFK 2, DropIndex 8, CreateIndex 22, RenameFK 1, AddFK 9 (**sem CreateTable AJR**) | **FAIL (não limpo)** |
| `prisma migrate diff --from-url phase1f_rebuild --to-schema-datamodel schema.prisma` | reconstrução + ops VULN1/2 | Mesmo delta estrutural (ops de segurança não são geridas pelo schema Prisma) | **FAIL (não limpo, esperado)** |
| PK/FK/índices/unique/defaults/tipos/relações exaustivos vs schema | parcial (inventário + diff) | divergências listadas | **PARTIAL** |

**Diferenças classificadas:** legítimas aditivas potenciais (AddFK composite/alguns índices) — **NOT PROVEN safe**; operacionais fora Prisma (RLS/roles/funções) — **separadas**; divergências schema↔DB/históricas/funcionais — **DECISION REQUIRED** (FK delete, 8 DropIndex, Product barcode partial, BusinessDocument unique scope).

## 10. Fase G — Teste de reconstrução
| Passo | Resultado | Classificação |
|---|---|---|
| Base descartável nova | `mf_rls_phase1f_rebuild` criada em 5440 | **PASS** |
| Reconstrução estrutura candidata | Clone controlado de `mf_rls_phase1f_v1_ajr` (estrutura base + AJR aditiva) | **PASS (reprodutível por template/artefactos)** |
| Estruturas operacionais segurança aplicadas | VULN-1+VULN-2 candidatas aplicadas (roles mínimas criadas no clone) | **PASS** |
| Relações/AJR/funções/policies verificadas | AJR policies `ajr_admin_all, ajr_jwt_writer_insert, ajr_self_select`; `mf_is_admin_executor`, `mf_revoke_jwt_self/admin` presentes com ownership/SECURITY DEFINER esperados; 50 policies, 0 `app.is_admin`, 48 `mf_is_admin_executor` após correção | **PASS** |
| Comparação com referência | AJR presente; VULN-1/2 ok; delta Prisma estrutural igual ao candidato AJR | **PASS (com delta classificado)** |
| Prisma diff pós-reconstrução | **não limpo** (mesmo delta VULN-3) | **FAIL / DECISION REQUIRED** |
| Migration futura aditiva simulada | **NOT EXECUTED** (diff não limpo; simular geraria/implicaria drops não autorizados) | **BLOCKED** |
| Histórico Prisma `_prisma_migrations` falsificado? | **Não** (nenhum insert em bases existentes) | **PASS** |

## 11. Fase H — Regressão de segurança (rebuild)
| Verificação | Resultado | Classificação |
|---|---|---|
| RLS ON/FORCE AJR | preservado pela migration | **PASS** |
| Policies sem `app.is_admin` após candidato | 0 (após aplicação corrigida) | **PASS** |
| `mf_is_admin_executor()` | presente, usada | **PASS** |
| Isolamento A/B (app login NOBYPASSRLS) | `tenant_isolation` n=1, tb=0 | **PASS** |
| Spoof `app.is_admin=true` | `spoof_admin` n=1 (não expande) | **PASS** |
| `SET ROLE mf_admin_executor` negado a app login | negado | **PASS** |
| AJR direct INSERT negado | negado | **PASS** |
| `mf_revoke_jwt_self` permitido (binding ok) | ok | **PASS** |
| `mf_revoke_jwt_admin` negado a app | negado | **PASS** |

**Nota:** primeira aplicação do candidato no rebuild expôs bug de escaping na cópia antiga do DO block (regex JS corrompido no artefacto tmp), resultando temporariamente em 48 policies ainda com `app.is_admin` e `spoof_admin`=2; foi **corrigido no clone descartável** com substituição literal robusta e revalidado (`spoof_admin`=1). O artefacto `remediation/candidate/v4-vuln1-vuln2-reconciled.sql` foi corrigido em `tmp` (não oficial). **Classificação do candidato operacional:** **PASS após correção**.

## 12. Critérios de aprovação 1F
| Critério | Estado | Classificação |
|---|---|---|
| 2 FKs reconciliadas ou formalmente justificadas | Justificadas; decisão pendente CASCADE↔RESTRICT | **DECISION REQUIRED** |
| 8 índices DropIndex classificados | Todos classificados | **PASS (classificação)** |
| 29 creates classificados (22 restantes pós-AJR) | Classificados por grupos; revisão linha-a-linha pré-aplicação pendente | **PARTIAL** |
| Caso Product barcode partial resolvido | Analisado; requer decisão/modelagem + dados 5437 | **DECISION REQUIRED** |
| AuthJwtRevocation corretamente representada | Sim, aditiva em candidato | **PASS** |
| Baseline reproduzível | Sim, por clone controlado + scripts candidatos | **PASS** |
| Prisma diff limpo ou diferenças justificadas | **Não limpo**; diferenças justificadas/classificadas mas não reconciliadas oficialmente | **FAIL** |
| Sem perda integridade referencial | Nenhuma alteração aplicada a origens | **PASS** |
| Sem perda RLS/grants | Preservado; regressão ok | **PASS** |
| Teste reconstrução aprovado | Estrutura+ops ok; diff estrutural pendente | **PARTIAL** |
| Simulação migration futura aprovada | Bloqueada por diff não limpo | **BLOCKED** |

## 13. Decisões pendentes (autorização necessária)
1. **FKs `StockMovement_tenantId_fkey` / `Warehouse_tenantId_fkey`:** adotar `ON DELETE RESTRICT` (alinha schema/segurança histórica) ou manter `CASCADE` (alinha DB atual) — ou modelar explicitamente no schema oficial. **Não alterar schema/migrations oficiais sem autorização.**
2. **8 `DropIndex`:** especialmente `BusinessDocument_tenantId_type_number_key` (unique com `type`) vs `@@unique([tenantId,number])` (sem `type`) — decisão funcional de numeração. Demais: performance/status/purpose.
3. **`Product_tenantId_barcode_key` partial:** preservar partial via migração/SQL gerido ou provar equivalência e aceitar unique plain; validar dados 5437.
4. **AddFKs/Rename/CreateIndex aditivos:** aplicar apenas após validação de órfãos/duplicados em 5437 read-only e plano de locks/rollback autorizado.
5. **Qualquer alteração em `prisma/schema.prisma` oficial ou migrations oficiais:** **STOP — proposta técnica prévia obrigatória.**

## 14. Riscos residuais
- Aplicar diff atual destruiria/altera semântica (FK cascade→restrict via drop/add, drops de unique/index). **ALTO.**
- 5437 sem `_prisma_migrations`; drift histórico. **ALTO para 1F em staging.**
- Dados reais 5437 não validados nesta fase (sem credencial/execução). **NOT PROVEN.**
- AddFKs composite podem falhar por dados órfãos/cross-tenant legados. **NOT PROVEN.**
- Tabelas RLS OFF pré-existentes (`Account,EmailActionToken,Session,VerificationToken`). **NOT PROVEN.**

## 15. Recomendação para fase seguinte
**Fase 1F = PARTIAL / BLOCKED / DECISION REQUIRED** (não PASS). Próximos passos autorizáveis:
1. Read-only 5437 (credenciais mínimas legítimas): validar duplicados/orfãos para BusinessDocument number/type, Product barcode (NULL/vazio/duplicados), órfãos SM/Warehouse/tables para AddFKs, memberships/grants `mf_*`.
2. Produzir **proposta técnica** (sem aplicar) para: (a) modelar explicitamente `onDelete` FKs tenant em schema oficial OU aceitar DB; (b) reconciliação índice-a-índice (manter DB, estender schema, ou migração aditiva); (c) barcode partial. Submeter antes de tocar ficheiros oficiais.
3. Em DB descartável com dados representativos (cópia autorizada): testar aditivos não-destrutivos e decisões FK; obter diff sem drops ou com drops aprovados.
4. Só após autorização: alteração oficial controlada + baseline/histórico em DB descartável + staging 5437 por janela aprovada. **Não integrar NextAuth/mint-check-revoke/logout, não 1F staging, não produção.**

## 16. Entrega
- **Relatório:** `JWT_REVOCATION_PHASE_1F_PRISMA_BASELINE_RECONCILIATION.md`
- **Ficheiros criados (phase-1f):** `inventory/*`, `analysis/*`, `scripts/00-20*.cjs`, `evidence/migrate-diff-*.sql` (tee pode estar UTF-16), DBs descartáveis 5440 `mf_rls_phase1f_v1`, `mf_rls_phase1f_v1_ajr`, `mf_rls_phase1f_rebuild`.
- **Artefacto tmp corrigido:** `tmp/jwt-revocation-baseline-lab/remediation/candidate/v4-vuln1-vuln2-reconciled.sql` (DO block literal).
- **Bases utilizadas:** 5440 `mf_rls_baseline_lab|lab2|remed_v4|remed_v5|phase1f_v1|phase1f_v1_ajr|phase1f_rebuild`.
- **Comandos chave:** `git rev-parse/status/branch`; `node` scripts phase-1f/remediation (pg); `npx prisma validate`; `npx prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --script` (3 alvos).
- **Resultados:** VULN-1/2 regressão **PASS** (rebuild); AJR representação **PASS**; Prisma diff **FAIL/BLOCKED** (2 DropFK, 8 DropIndex, 22 CreateIndex, 1 RenameFK, 9 AddFK); reconstrução estrutural+ops **PASS/PARTIAL**; migration futura **BLOCKED**.
- **Diferenças ainda existentes:** FK delete semantics (CASCADE vs RESTRICT), 8 drops semânticos, barcode partial, creates/aditivos não validados com dados reais, histórico `_prisma_migrations` ausente em 5437.
- **Estado final Fase 1F:** **BLOCKED / DECISION REQUIRED** (VULN-3 não reconciliado de forma aplicável sem decisão/autorização; nada destrutivo aplicado).

**Sem commits. Sem 5437/5436/Supabase/produção. Sem alterações oficiais schema/migrations/env/código.**