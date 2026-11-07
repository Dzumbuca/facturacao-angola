# JWT_REVOCATION_PHASE_1G_RECONCILIATION_PROPOSAL

**Date:** 2026-11-06  
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch/Commit:** `wms-v2-e2e-staging` @ `95e00366`  
**Base:** `JWT_REVOCATION_PHASE_1F_PRISMA_BASELINE_RECONCILIATION.md`, `JWT_REVOCATION_PHASE_1G_ARCHITECTURAL_DECISIONS.md`, evidência `tmp/jwt-revocation-baseline-lab/phase-1f|1g/`.  
**Natureza:** **PROPOSTA TÉCNICA — NÃO EXECUTAR alterações oficiais.** Não altera `prisma/schema.prisma`, migrations oficiais, `.env*`, código app/Auth, 5437/5436/Supabase/produção.

## 1. Princípios
1. Semântica > diff vazio.
2. Aditivo e reversível antes de destrutivo.
3. Nunca dropar índices/constraints/colunas existentes sem prova + autorização.
4. Validar dados reais 5437 (read-only) antes de FKs/uniques aditivos.
5. VULN-1/VULN-2 preservadas (regressão obrigatória).
6. `_prisma_migrations` nunca falsificado em DBs existentes.

## 2. Decisões finais recomendadas (pendentes de autorização)

### 2.1 Foreign keys prioritárias (2)
| FK | Atual DB proxy | Proposta alvo | Requisito |
|---|---|---|---|
| `StockMovement_tenantId_fkey` | `Tenant(id) ON DELETE CASCADE` | **RESTRICT/NO ACTION** (recomendado) + modelagem explícita no schema oficial | decisão produto sobre delete tenant; workflow offboarding/arquivamento; migração autorizada |
| `Warehouse_tenantId_fkey` | `Tenant(id) ON DELETE CASCADE` | **RESTRICT/NO ACTION** (recomendado) | idem; coordenar dependências warehouse/stock |

**Alternativa:** manter CASCADE somente se houver requisito formal de hard-delete tenant com aceitação de perda histórica — **não recomendado** para stock/auditoria.

### 2.2 Oito índices dropados pelo diff
| Índice | Decisão proposta |
|---|---|
| `BusinessDocument_tenantId_type_number_key` | **PRESERVAR**. Se regra de negócio for `number` único por tenant sem `type`, fazer alteração de schema/app + migração aditiva de transição + validação colisões 5437. |
| `BusinessDocument_tenantId_type_status_issueDate_idx` | **PRESERVAR** até revisão de queries. |
| `EmailActionToken_userId_purpose_expiresAt_idx` | **PRESERVAR**. |
| `EmailCampaign_status_scheduledAt_idx` | **PRESERVAR**. |
| `EmailCampaignRecipient_campaignId_status_createdAt_idx` | **PRESERVAR**. |
| `EmailDelivery_status_createdAt_idx` | **PRESERVAR**. |
| `PlatformTeamInvite_email_status_idx` | **PRESERVAR**. |
| `PlatformTeamInvite_status_expiresAt_idx` | **PRESERVAR**. |

### 2.3 22 CreateIndex propostos
| Classe | Itens | Proposta |
|---|---|---|
| SAFE ADDITIVE (após validar nome/duplicidade nominal) | `BusinessDocumentCounter_tenantId_idx`, `Product_tenantId_idx`, `Product_codigo_idx`, `StockMovement_warehouseId_idx`, `StockMovement_transferId_idx`, `StockMovement_purchaseReceptionId_idx`, `StockMovement_transferReceptionId_idx`, `StockMovement_createdAt_idx` | **Candidato aditivo**, preferir `CREATE INDEX CONCURRENTLY` em ambientes reais; validar plano/locks. |
| ADDITIVE WITH DATA VALIDATION | `StockMovement_reversalOfId_key`, `StockMovement_tenantId_idempotencyKey_key`, `StockMovement_tenantId_transferReceptionId_key`, `StockMovement_tenantId_reversalOfId_key`, `BusinessDocument_tenantId_id_key` | Validar duplicados/NULLs em 5437 read-only antes. |
| DUPLICATE/NOT PROVEN | `StockMovement_reversalOfId_idx` (pode redundar com unique) | Rever necessidade. |
| SEMANTICALLY DIFFERENT / pacote com drops | `BusinessDocument_tenantId_number_key` (conflita com B1), `EmailActionToken_userId_expiresAt_idx`, `EmailCampaign_scheduledAt_idx`, `EmailCampaignRecipient_campaignId_createdAt_idx`, `EmailDelivery_createdAt_idx`, `PlatformTeamInvite_email_idx`, `PlatformTeamInvite_expiresAt_idx` | **Não aplicar** enquanto índices DB correspondentes forem preservados sem decisão. |
| SEMANTICALLY DIFFERENT (barcode) | `Product_tenantId_barcode_key` plain unique | **Não substituir** partial; ver 2.5. |

### 2.4 9 AddForeignKey + 1 RenameForeignKey
| Item | Proposta | Validação prévia |
|---|---|---|
| Rename `StockMovement_tenant_product_fkey` → `StockMovement_tenantId_productId_fkey` | **Aditivo/baixo risco** após smoke test | confirmar def idêntica, dependências |
| Add `ProductWarehouseStock(tenantId,warehouseId)->Warehouse(tenantId,id)` | **ADDITIVE WITH DATA VALIDATION** | órfãos/cross-tenant em 5437 |
| Add `PurchaseReception(tenantId,warehouseId)->Warehouse(tenantId,id)` | idem | órfãos |
| Add `StockMovement(tenantId,reversalOfId)->StockMovement(tenantId,id)` | idem; confirmar unique target `(tenantId,id)` | self-ref órfãos; semântica reversal |
| Add `StockMovement(tenantId,purchaseReceptionId)->PurchaseReception(tenantId,id)` | idem | órfãos |
| Add `StockMovement(tenantId,transferId)->StockTransfer(tenantId,id)` | idem | órfãos |
| Add `StockMovement(tenantId,transferReceptionId)->StockTransferReception(tenantId,id)` | idem | órfãos |
| Add `StockMovement(tenantId,warehouseId)->Warehouse(tenantId,id)` | idem | órfãos |
| Add/replace `Warehouse_tenantId_fkey` RESTRICT e `StockMovement_tenantId_fkey` RESTRICT | **DECISION REQUIRED** (vinculado a 2.1) | decisão negócio + migração + dependências |

**Técnica futura:** `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` em janela controlada; medir locks/tempo em cópia.

### 2.5 Product barcode
**Proposta:** **PRESERVAR** `UNIQUE (tenantId,barcode) WHERE barcode IS NOT NULL`.
- Validar 5437 read-only: `barcode IS NULL`, `barcode=''`, espaços, duplicados não-null por tenant.
- Se `''` existir, decisão: normalizar para `NULL` (mudança app+dado autorizada) ou manter semântica actual.
- Não usar `@@unique([tenantId,barcode])` plain como substituto sem prova.
- Se schema oficial precisar refletir regra, usar mecanismo autorizado (SQL migration gerida/operacional documentada); Prisma padrão não modela partial unique nativamente.

### 2.6 AuthJwtRevocation
- Estrutura: migration oficial `20261105233000_auth_jwt_revocation_phase1` permanece **fonte aditiva**; não duplicar.
- Segurança operacional: manter camada VULN-1 (`mf_is_admin_executor`, policies sem GUC setável) + VULN-2 (self insert direto removido, `mf_revoke_jwt_self/admin` controladas, `mf_jwt_writer` dedicada) como **SQL operacional separado** do modelo Prisma, com versionamento em `tmp`/candidatos até autorização.
- Em 5437/staging: aplicar apenas por pacote autorizado, com backup/rollback e verificação RLS/FORCE/grants.

### 2.7 `_prisma_migrations`
- **Curto prazo:** Estratégia **C** — baseline isolada + evolução aditiva; sem `migrate resolve` em DBs existentes.
- **Médio prazo (condicionado):** Estratégia **A** — baseline controlada após diff reconciliado, testada em DB descartável com histórico controlado. **Nunca** em 5437/produção sem prova.
- **Evitar:** Estratégia B como primeiro passo (custo/risco alto).

## 3. Sequência de alterações futuras (proposta)
| Fase | Conteúdo | Pré-condições | Classe |
|---|---|---|---|
| P0 | Validação read-only 5437 (órfãos, duplicados, barcode, BD number/type, memberships `mf_*`, RLS/policies reais) | credenciais mínimas legítimas, janela read-only | **autorização operacional** |
| P1 | Decisões formais: delete tenant FKs, numeração BD, barcode, pacote índices | P0 + produto/engenharia | **D (negócio) / autorização** |
| P2 | Pacote aditivo seguro em DB descartável com dados representativos: indexes SAFE ADDITIVE + AddFKs NOT VALID/VALIDATE candidatos | P0, P1 parcial | **A/B (aditivo)** |
| P3 | Proposta de alteração oficial (schema/migrations/SQL operacional) | P2 green, diff classificado | **B/C — requer autorização explícita; não executado aqui** |
| P4 | Aplicação staging 5437 autorizada: backup, aditivos, validação RLS/VULN-1/2, rollback pronto | P3 aprovado | **autorização separada** |
| P5 | Reconciliação histórica Prisma / baseline controlada | P4 estável | **DECISION REQUIRED** |
| P6 | Integração NextAuth mint/check/revoke/logout/refresh (A+/E-lite) | VULN-3 controlada + autorização | **fora desta trilha** |

## 4. Plano de validação
- **Estrutural:** `prisma validate`; `migrate diff` por alvo descartável; catálogo FK/índice/policy/grant antes/depois.
- **Dados (5437 read-only):** queries de órfãos por AddFK; duplicados por unique proposto; barcode `''`/NULL/duplicados; `BusinessDocument` `(tenantId,number)` vs `(tenantId,type,number)` colisões.
- **Segurança:** regressão VULN-1 (spoof `app.is_admin`, isolamento A/B, SET ROLE negado), VULN-2 (direct insert negado, self/admin functions, grants), RLS/FORCE/policies intactas.
- **Performance:** `EXPLAIN` amostral, criação `CONCURRENTLY`, locks monitorados.
- **Funcional:** fluxos stock, documentos, convites, tokens email — smoke tests autorizados.

## 5. Plano de rollback
- Toda mudança DDL real: backup prévio verificado; script de reversão por item; para índices aditivos, `DROP INDEX CONCURRENTLY` se necessário; para FKs aditivas, `DROP CONSTRAINT`; para replace de FK semântica, **não executar sem** janela + backup + decisão.
- **Nunca** usar rollback que destrua dados históricos para “corrigir” schema.
- AJR/policies/funções: manter SQL idempotente versionado; testar rollback em descartável.

## 6. Separação por classe (obrigatória)
| Classe | Exemplos | Ação agora |
|---|---|---|
| A. Aditivo seguro | alguns CreateIndex/rename, AJR aditiva em base sem AJR | somente proposta; validar P0/P2 |
| B. Exige modificação schema Prisma | `onDelete` explícito, barcode rule, BusinessDocument unique rule, índices declarados | **NÃO executar**; proposta escrita |
| C. Exige migrations oficiais | qualquer mudança oficial versionada | **NÃO executar** |
| D. Exige decisão de negócio | delete tenant, numeração documental, barcode vazio/normalização | **NÃO executar** |
| E. Pode causar perda de dados | DropIndex/FK replacement que altere semântica/cascata; cleanup | **NÃO executar** |

## 7. Entregáveis 1G
- `JWT_REVOCATION_PHASE_1G_ARCHITECTURAL_DECISIONS.md`
- `JWT_REVOCATION_PHASE_1G_RECONCILIATION_PROPOSAL.md`
- `tmp/jwt-revocation-baseline-lab/phase-1g/` (`inventory/`, `analysis/`, `decisions/`, `candidate/`, `scripts/`, `evidence/`, `reports/`)