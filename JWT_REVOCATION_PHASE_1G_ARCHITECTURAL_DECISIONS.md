# JWT_REVOCATION_PHASE_1G_ARCHITECTURAL_DECISIONS

**Date:** 2026-11-06  
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch:** `wms-v2-e2e-staging`  
**Commit referência:** `95e00366`  
**Escopo:** Fase 1G — decisões arquitecturais fundamentadas para VULN-3 (reconciliação Prisma↔PostgreSQL). **Análise, experiências isoladas em laboratório e propostas apenas.** Nenhuma alteração oficial.

## 1. Resumo executivo
- **VULN-1 (RLS)** e **VULN-2 (AuthJwtRevocation/JWT revogação candidata)**: **PASS em laboratório**, preservadas na reconstrução 1F/1G; **não alteradas**.
- **VULN-3 (Prisma/reconciliação estrutural): DECISION REQUIRED / BLOCKED**. O diff Prisma (`phase1f_v1_ajr` → `prisma/schema.prisma`) continua com **2 DropForeignKey, 8 DropIndex, 22 CreateIndex, 9 AddForeignKey, 1 RenameForeignKey** (`tmp/jwt-revocation-baseline-lab/phase-1g/analysis/diff-items.json`, derivado de 1F). Um “diff vazio” **não é objectivo**; a prioridade é semântica de dados, integridade referencial, isolamento multi-tenant, histórico operacional e segurança JWT.
- **Bloqueios principais:** semântica de `ON DELETE` (Tenant→StockMovement/Warehouse), unicidade `BusinessDocument` (`tenantId,type,number` no DB vs `tenantId,number` no schema), índice partial `Product_tenantId_barcode_key`, drift de 8 índices de performance/filtragem, validação de dados reais 5437 (**NOT PROVEN**, 5437 read-only sem credencial usada), `_prisma_migrations` ausente.

## 2. Estado inicial / ambiente / backups
| Item | Resultado | Classificação |
|---|---|---|
| Git antes | `95e00366`, `wms-v2-e2e-staging`, worktree preexistente pesado preservado | **PASS (preservado)** |
| Git depois | Inalterado; novos untracked apenas `tmp/jwt-revocation-baseline-lab/phase-1g/*`, `JWT_REVOCATION_PHASE_1G_*` | **PASS** |
| Laboratório | `127.0.0.1:5440`, PostgreSQL 17.11, role `postgres` | **PASS** |
| 5437 staging | **READ-ONLY; nenhuma escrita; sem credencial postgres válida neste passo** | **PASS (limite respeitado) / NOT PROVEN (dados reais)** |
| 5436/Supabase/produção | Não usados | **PASS** |
| Oficiais alterados | Nenhum (`.env*`, `schema.prisma`, migrations oficiais, Auth/NextAuth/código) | **PASS** |
| Backups existentes | `remediation/backup/lab1_pre_remediation.backup`, `remediation/backup/remed_v2c.backup`, `phase-1e/backup/lab1.backup` (preservados) | **PASS** |
| Bases 1G | `mf_rls_phase1g_synth` criada/descartável para semântica sintética; bases 1F preservadas | **PASS** |

## 3. Decisões arquitecturais

### 3.1 Fase A — Foreign keys prioritárias
Matriz (evidência: `phase-1f/inventory/phase1f_v1-fks.json`, `phase-1g/evidence/synthetic-semantics.json` — sintético):

| Critério | CASCADE (DB atual proxy) | RESTRICT (tendência diff Prisma por `onDelete` omitido) |
|---|---|---|
| Integridade referencial | Mantém integridade removendo filhos | Mantém integridade bloqueando remoção do pai |
| Histórico de stock | **Alto risco**: delete de Tenant apaga `StockMovement`/`Warehouse` ligados | **Preserva** histórico/estrutura até decisão explícita |
| Auditoria | **Prejudicial** (perda de evidência operacional/financeira) | **Favorável** |
| Eliminação de tenant | Operacionalmente fácil, mas destrutiva | Exige workflow explícito (retenção, anonimização, export, arquivamento, ordem de dependências) |
| Eliminação de armazém | N/A directo pela FK `Warehouse.tenantId->Tenant`; mas cascata de Tenant afeta armazéns | Bloqueio protetor; exige política de desativação/remoção controlada |
| Risco de perda de dados | **ALTO** (CASCADE em dados históricos) | **BAIXO** (bloqueio em vez de apagamento) |

| FK | DB (proxy) | Schema/diff | Recomendação fundamentada | Classificação |
|---|---|---|---|---|
| `StockMovement_tenantId_fkey` (`StockMovement.tenantId` → `Tenant.id`) | `ON UPDATE CASCADE ON DELETE CASCADE` | diff: Drop+Add `ON DELETE RESTRICT` (schema omite `onDelete`) | **RESTRICT/NO ACTION recomendado** para proteger histórico de movimentos (auditoria/financeiro/stock). Não aplicar automaticamente: alterar semântica exige decisão de produto, fluxo de offboarding tenant, validação de dependências e migração autorizada. Se negócio exigir hard-delete, desenhar processo explícito; não confiar em cascata silenciosa. | **DECISION REQUIRED** |
| `Warehouse_tenantId_fkey` (`Warehouse.tenantId` → `Tenant.id`) | `ON UPDATE CASCADE ON DELETE CASCADE` | Drop+Add `ON DELETE RESTRICT` | **RESTRICT recomendado** por consistência estrutural e proteção de inventário; avaliar ordem com `StockMovement`, `ProductWarehouseStock`, `PurchaseReception`, reservas/transferências. | **DECISION REQUIRED** |

**Nota:** `prisma/schema.prisma` (oficial, não alterado) omite `onDelete` nestas relações; o comportamento pretendido deve ser **modelado explicitamente** numa alteração oficial autorizada (seja `Restrict/NoAction` ou `Cascade`), para eliminar ambiguidade. **NOT PROVEN** qual regra de negócio actual para eliminação de tenant.

### 3.2 Fase B — 8 índices que o diff pretende eliminar
Nenhuma remoção executada. Evidência: `phase-1f/analysis/index-ajr-evidence.json`, `phase-1g/analysis/diff-items.json`, schema `BusinessDocument`.

| Índice | Tabela | Definição DB | Alternativa/tendência schema | Impacto funcional/perf | Recomendação | Classificação |
|---|---|---|---|---|---|---|
| `BusinessDocument_tenantId_type_number_key` | `BusinessDocument` | UNIQUE(`tenantId`,`type`,`number`) | schema `@@unique([tenantId,number])` → unique sem `type` | **Semântico crítico**: DB permite mesmo `number` em tipos diferentes por tenant; schema/diff tornaria `number` global por tenant. Sintético 1G confirmou diferença (`bd_db` aceita A/001 + B/001; `bd_schema` rejeita). | **PRESERVAR DB** até decisão funcional de numeração. Se alterar para `tenantId,number`, exigir prova 5437 de ausência de colisões cross-type, alteração de aplicação/geração de números e migração autorizada. | **DECISION REQUIRED** |
| `BusinessDocument_tenantId_type_status_issueDate_idx` | `BusinessDocument` | INDEX(`tenantId`,`type`,`status`,`issueDate`) | schema mantém (`tenantId,issueDate`), (`customerId,issueDate`) | Perda de seletividade `type/status`; risco perf em listagens/filas. | **PRESERVAR** (ou substituir só após análise de queries reais). | **DECISION REQUIRED** |
| `EmailActionToken_userId_purpose_expiresAt_idx` | `EmailActionToken` | INDEX(`userId`,`purpose`,`expiresAt`) | `@@index([userId,expiresAt])` | Perde `purpose`; impacto em lookup/expurgo por finalidade. | **PRESERVAR**. | **DECISION REQUIRED** |
| `EmailCampaign_status_scheduledAt_idx` | `EmailCampaign` | INDEX(`status`,`scheduledAt`) | `@@index([scheduledAt])` | Perde `status`; impacto em agendamento/fila. | **PRESERVAR**. | **DECISION REQUIRED** |
| `EmailCampaignRecipient_campaignId_status_createdAt_idx` | `EmailCampaignRecipient` | INDEX(`campaignId`,`status`,`createdAt`) | `@@index([campaignId,createdAt])` | Perde `status`. | **PRESERVAR**. | **DECISION REQUIRED** |
| `EmailDelivery_status_createdAt_idx` | `EmailDelivery` | INDEX(`status`,`createdAt`) | sem equivalente status no schema | Perde `status`. | **PRESERVAR**. | **DECISION REQUIRED** |
| `PlatformTeamInvite_email_status_idx` | `PlatformTeamInvite` | INDEX(`email`,`status`) | `@@index([email])` | Perde `status`. | **PRESERVAR**. | **DECISION REQUIRED** |
| `PlatformTeamInvite_status_expiresAt_idx` | `PlatformTeamInvite` | INDEX(`status`,`expiresAt`) | `@@index([expiresAt])` | Perde `status`. | **PRESERVAR**. | **DECISION REQUIRED** |

### 3.3 Fase C — 22 CreateIndex / 9 AddForeignKey / 1 RenameForeignKey
Classificação técnica (estrutura/pré-requisitos lab 5440 proxy). **Dados reais 5437: NOT PROVEN.**

| Item | SQL (resumo) | Pré-requisitos lab | Risco | Classificação |
|---|---|---|---|---|
| RenameFK | `StockMovement_tenant_product_fkey` → `StockMovement_tenantId_productId_fkey` | nome existe; def funcional equivalente (composite tenant+product, RESTRICT/CASCADE) | baixo, mas validar dependências/ferramentas | **SAFE ADDITIVE (rename semântico de metadados)** / **ADDITIVE WITH DATA VALIDATION** mínima |
| AddFK #1 | `Warehouse_tenantId_fkey` ON DELETE RESTRICT | alvo existe; conflito com drop+add mesma FK (cascade→restrict) | semântico/operacional | **SEMANTICALLY DIFFERENT / DECISION REQUIRED** |
| AddFK #2 | `ProductWarehouseStock(tenantId,warehouseId)->Warehouse(tenantId,id)` RESTRICT | `Warehouse(tenantId,id)` unique existe | órfãos/cross-tenant em 5437? | **ADDITIVE WITH DATA VALIDATION** |
| AddFK #3 | `PurchaseReception(tenantId,warehouseId)->Warehouse(tenantId,id)` RESTRICT | alvo existe | órfãos? | **ADDITIVE WITH DATA VALIDATION** |
| AddFK #4 | `StockMovement(tenantId,reversalOfId)->StockMovement(tenantId,id)` SET NULL | self-ref; SM PK `(id)` existe; precisa unique/target compatível `(tenantId,id)`? schema tem `@@unique([tenantId,id])` implícito em vários; lab tem `StockMovement_tenantId_id_key` | possível falha se alvo composite não suportado como esperado; dados órfãos | **ADDITIVE WITH DATA VALIDATION / NOT PROVEN** |
| AddFK #5 | `StockMovement_tenantId_fkey` RESTRICT | ver #1 | semântico | **SEMANTICALLY DIFFERENT / DECISION REQUIRED** |
| AddFK #6 | `StockMovement(tenantId,purchaseReceptionId)->PurchaseReception(tenantId,id)` SET NULL | alvo tabela existe | órfãos/cross-tenant | **ADDITIVE WITH DATA VALIDATION** |
| AddFK #7 | `StockMovement(tenantId,transferId)->StockTransfer(tenantId,id)` SET NULL | alvo existe | órfãos | **ADDITIVE WITH DATA VALIDATION** |
| AddFK #8 | `StockMovement(tenantId,transferReceptionId)->StockTransferReception(tenantId,id)` SET NULL | alvo existe | órfãos | **ADDITIVE WITH DATA VALIDATION** |
| AddFK #9 | `StockMovement(tenantId,warehouseId)->Warehouse(tenantId,id)` RESTRICT | alvo existe | órfãos | **ADDITIVE WITH DATA VALIDATION** |
| CreateIndex `BusinessDocument_tenantId_id_key` | unique(`tenantId,id`) | aditivo | colateral com decisão #B1 se usado para substituir semântica | **ADDITIVE WITH DATA VALIDATION** |
| CreateIndex `BusinessDocument_tenantId_number_key` | unique(`tenantId,number`) | **conflita semanticamente** com DB unique(`tenantId,type,number`) | pode falhar ou alterar regra | **SEMANTICALLY DIFFERENT / DECISION REQUIRED** |
| CreateIndex `BusinessDocumentCounter_tenantId_idx` | index(`tenantId`) | aditivo | baixo | **SAFE ADDITIVE** (validar duplicado nominal) |
| CreateIndex `EmailActionToken_userId_expiresAt_idx` | index(`userId,expiresAt`) | coexistência com índice que inclui `purpose`? DB tem purpose index; diff também quer dropar purpose index | parte de pacote semântico B3 | **SEMANTICALLY DIFFERENT** (pacote) |
| CreateIndex `EmailCampaign_scheduledAt_idx` | index(`scheduledAt`) | pacote B4 | **SEMANTICALLY DIFFERENT** |
| CreateIndex `EmailCampaignRecipient_campaignId_createdAt_idx` | index(`campaignId,createdAt`) | pacote B5 | **SEMANTICALLY DIFFERENT** |
| CreateIndex `EmailDelivery_createdAt_idx` | index(`createdAt`) | pacote B6 (status removido noutro) | **ADDITIVE WITH DATA VALIDATION** / pacote |
| CreateIndex `PlatformTeamInvite_email_idx` | index(`email`) | pacote B7 | **SEMANTICALLY DIFFERENT** |
| CreateIndex `PlatformTeamInvite_expiresAt_idx` | index(`expiresAt`) | pacote B8 | **SEMANTICALLY DIFFERENT** |
| CreateIndex `Product_tenantId_idx` | index(`tenantId`) | aditivo | baixo | **SAFE ADDITIVE** |
| CreateIndex `Product_codigo_idx` | index(`codigo`) | aditivo | baixo | **SAFE ADDITIVE** |
| CreateIndex `Product_tenantId_barcode_key` | unique(`tenantId,barcode`) plain | DB tem **mesmo nome?** lab tem partial com mesmo nome lógico? evidência 1F: `createIdxExists` encontrou 1 nome (partial `WHERE barcode IS NOT NULL`); diff propõe plain | **substituição semântica/definição** | **SEMANTICALLY DIFFERENT / DESTRUCTIVE if applied as replacement / DECISION REQUIRED** |
| CreateIndex `StockMovement_reversalOfId_key` | unique(`reversalOfId`) | aditivo; validar duplicados não-null | dados 5437? | **ADDITIVE WITH DATA VALIDATION** |
| CreateIndex `StockMovement_warehouseId_idx` | index(`warehouseId`) | aditivo | baixo | **SAFE ADDITIVE** |
| CreateIndex `StockMovement_transferId_idx` | index(`transferId`) | aditivo | baixo | **SAFE ADDITIVE** |
| CreateIndex `StockMovement_purchaseReceptionId_idx` | index(`purchaseReceptionId`) | aditivo | baixo | **SAFE ADDITIVE** |
| CreateIndex `StockMovement_transferReceptionId_idx` | index(`transferReceptionId`) | aditivo | baixo | **SAFE ADDITIVE** |
| CreateIndex `StockMovement_reversalOfId_idx` | index(`reversalOfId`) | pode coexistir/redundar com unique | redundância potencial | **DUPLICATE / NOT PROVEN** |
| CreateIndex `StockMovement_createdAt_idx` | index(`createdAt`) | aditivo | baixo | **SAFE ADDITIVE** |
| CreateIndex `StockMovement_tenantId_idempotencyKey_key` | unique(`tenantId,idempotencyKey`) | validar duplicados e NULL behavior | dados 5437? | **ADDITIVE WITH DATA VALIDATION** |
| CreateIndex `StockMovement_tenantId_transferReceptionId_key` | unique(`tenantId,transferReceptionId`) | validar | dados 5437? | **ADDITIVE WITH DATA VALIDATION** |
| CreateIndex `StockMovement_tenantId_reversalOfId_key` | unique(`tenantId,reversalOfId`) | validar | dados 5437? | **ADDITIVE WITH DATA VALIDATION** |

**Nenhuma destas alterações foi aplicada em bases existentes.** Aplicação futura exigirá validação read-only 5437, `CREATE INDEX CONCURRENTLY` onde apropriado, `NOT VALID`/`VALIDATE CONSTRAINT` para FKs grandes, janela e rollback.

### 3.4 Fase D — Product barcode (`Product_tenantId_barcode_key`)
| Aspecto | Evidência | Classificação |
|---|---|---|
| DB (proxy 5437) | `UNIQUE (tenantId,barcode) WHERE barcode IS NOT NULL` (partial) | **PASS (observado em lab/proxy)** |
| Schema Prisma (oficial) | `@@unique([tenantId,barcode])` — sem predicate | **PASS (observado)** |
| Sintético 1G | Partial e plain: múltiplos NULL OK; `''` duplicado rejeitado em ambos; valor não-null duplicado rejeitado em ambos. Diferença funcional não demonstrada neste caso simples. | **PASS (sintético limitado)** |
| Dados 5437 | NULL/vazio/espaços/duplicados tenant/cross-tenant: **não consultados** | **NOT PROVEN** |
| Comportamento app | create/edit/lookup/normalização: **não inspecionado em runtime** | **NOT PROVEN** |
| Expressividade Prisma | Prisma schema padrão não representa partial unique index; `@@unique` gera unique constraint/index padrão | **PASS (limitação técnica)** |

**Regra funcional mais provável (a confirmar):** A — barcode opcional, único por tenant quando preenchido. **Não escolher sem evidência.**

**Decisão/recomendação:** **DECISION REQUIRED**.
- **Preservar** índice partial no DB como verdade operacional.
- **Não** substituir por unique plain via diff automático.
- Alternativas técnicas (proposta futura, sem alterar oficial agora): (1) manter partial por SQL operacional gerido fora do modelo Prisma; (2) normalizar `''`→NULL na aplicação + migração de dados + constraint compatível após prova; (3) modelar apenas o que Prisma suporta e aceitar drift controlado documentado; (4) usar `@unique` removido do schema e constraint custom documentada — **requer alteração oficial autorizada**.

### 3.5 Fase D/E — AuthJwtRevocation
- Migration oficial existe: `prisma/migrations/20261105233000_auth_jwt_revocation_phase1/migration.sql` (não alterada). Modelo `AuthJwtRevocation` existe em `schema.prisma`.
- Candidato 1F com AJR aplicada removeu `CreateTable AuthJwtRevocation` do diff. **PASS (representação estrutural em lab).**
- **Conceptual reconciliation:** AJR é tabela **Prisma-managed** (estrutura) + **operational hardening** (RLS/FORCE/policies/grants/funções VULN-2) separado. Não duplicar; preservar hardening validado.

### 3.6 Fase E — `_prisma_migrations` ausente
| Estratégia | Vantagens | Riscos | Requisitos | Rollback | Prisma Migrate | Produção/5437 |
|---|---|---|---|---|---|---|
| A. Baseline controlada a partir do estado actual | caminho a fluxo Prisma moderno após reconciliação | pode mascarar drift; `migrate resolve` indevido falsifica histórico | snapshot fiel, diff limpo/justificado, teste **apenas em DB descartável** | artefactos versionados; DB real só com autorização | bom após prova | **alto risco** sem prova |
| B. Reconciliação histórica das migrations | preserva linhagem | 25 migrations vs DB real divergente; alto custo/erro | comparação migration-a-migration, reparações controladas | complexo | incerto | muito arriscado |
| C. Baseline isolada + evolução aditiva (curto prazo) | **mais segura**; não finge histórico em DB existente; permite aditivos aprovados (AJR já aditiva) | Prisma migrate parcial; disciplina operacional necessária | SQL aditivo controlado, catálogo de drift, validação 5437 read-only | fácil (não mexe histórico real) | limitado até reconciliação | **preferida** para 5437 |

**Decisão:** **DECISION REQUIRED**. Recomendação: **C agora**, evoluir para **A** só após: reconciliação de decisões B/C/D, diff limpo ou justificações formais aprovadas, prova em DB descartável com histórico controlado, backup/rollback aprovados. **Nunca** `migrate resolve`/inserts em `_prisma_migrations` em 5437/produção sem prova e autorização explícita.

## 4. Alterações recomendadas (proposta; não executar)
Ver `JWT_REVOCATION_PHASE_1G_RECONCILIATION_PROPOSAL.md`.

## 5. Alterações que exigem autorização
- Qualquer mudança em `prisma/schema.prisma` oficial ou migrations oficiais.
- Qualquer DDL em 5437/staging/produção.
- Resolução de semântica `ON DELETE` tenant FKs.
- Resolução da regra de numeração `BusinessDocument` (unique com/sem `type`).
- Resolução do índice partial `Product.barcode`.
- Drops/replacements de índices DB existentes.
- AddFKs com validação de dados reais.
- Estratégia `_prisma_migrations`/`migrate resolve`.
- Integração NextAuth/mint-check-revoke/logout/refresh (fora 1G).

## 6. Evidências técnicas
- 1F: `tmp/jwt-revocation-baseline-lab/phase-1f/inventory/*`, `phase-1f/analysis/*`, `phase-1f/evidence/migrate-diff-*.sql`.
- 1G: `tmp/jwt-revocation-baseline-lab/phase-1g/analysis/diff-items.json`, `phase-1g/decisions/phase-1g-decisions.json`, `phase-1g/evidence/synthetic-semantics.json`, `phase-1g/evidence/add-fk-prereqs.json`, `phase-1g/evidence/phase-g-extra.json`, scripts `01*-05*`.
- Sintético 1G (`mf_rls_phase1g_synth`, 5440): barcode partial/plain comportamento NULL/`''`/duplicados; `BusinessDocument` unique `tenantId,type,number` vs `tenantId,number`; FK `CASCADE` apaga filhos vs `RESTRICT` bloqueia. **SINTÉTICO — não dados 5437.**

## 7. Testes realizados
| Teste | Resultado | Classificação |
|---|---|---|
| Análise estática schema/DB/diffs 1F/1G | concluída | **PASS** |
| Semântica sintética barcode/BD/FK | concluída | **PASS (sintético)** |
| Regressão VULN-1/VULN-2 (1F rebuild) | preservada | **PASS** |
| Validação dados 5437 (duplicados/órfãos/barcodes/BD) | não executada | **NOT PROVEN** |
| Aplicação de FKs/índices propostos | não executada | **NOT EXECUTED** |
| Alterações oficiais | não executadas | **PASS (limite)** |

## 8. Limitações
- 5437 não consultada (sem credencial; read-only). Dados reais, órfãos, colisões de barcode/BusinessDocument: **NOT PROVEN**.
- Análise de queries/uso de índices no código: parcial (não exaustiva). **NOT PROVEN**.
- Performance/lock de criação de índices/FKs em volume real: **NOT PROVEN**.
- Regras de negócio (eliminação tenant, numeração documental, barcode vazio): **NOT PROVEN**.

## 9. Riscos residuais
- **ALTO:** aceitar diff Prisma cego pode causar perda de semântica (BusinessDocument unique, barcode partial) e mudança destrutiva de delete behavior (CASCADE→RESTRICT via drop/add exige decisão; manter CASCADE arrisca perda de histórico).
- **ALTO:** drift histórico Prisma sem `_prisma_migrations`.
- **MÉDIO:** AddFKs podem falhar por dados legados; índices `CONCURRENTLY`/validação necessários.
- **MÉDIO:** RLS OFF pré-existente em tabelas auth/adapter (já conhecido). **NOT PROVEN**.

## 10. Estado da VULN-3
**DECISION REQUIRED / BLOCKED** (não remediada). Estrutura candidata reprodutível e AJR representada em lab; reconciliação oficial segura depende de decisões de negócio/técnicas e validação 5437 read-only.

## 11. Próxima fase recomendada
**Fase 1H (proposta) — validação read-only autorizada + pacote de decisão oficial**: (1) consulta read-only 5437 com credenciais mínimas para órfãos/duplicados/barcode/BD; (2) decisões formais produto/engenharia sobre FKs tenant delete, numeração BD, barcode; (3) rascunho de alteração oficial (schema/migrations/SQL operacional) **apenas como proposta**; (4) prova em DB descartável com diff limpo ou justificativas formais; (5) só depois autorização separada para 5437/staging. **Não** integrar NextAuth/JWT runtime nem produção nesta trilha.