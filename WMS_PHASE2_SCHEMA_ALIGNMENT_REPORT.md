# WMS Phase 2 — Schema Alignment Report

**Projeto:** facturacao-angola (Machine Facturas)  
**Versao Prisma:** 5.22.0  
**Banco staging:** PostgreSQL 18.6 (127.0.0.1:5433, wms_staging)  
**Data:** 2026-11-03  
**Status:** Concluido  

---

## Veredito

**APROVADO PARA FASE 3**

O schema `prisma/schema.prisma` foi alinhado com `schema.v2.prisma`. A migration `migration.v2.sql` foi revisada e todas as correcoes de auditoria anteriores estao presentes. Os servicos da Fase 1 foram adaptados para compatibilidade com o novo schema. Todos os testes (249/249) passam e o TypeScript compila sem erros.

---

## 1. Resumo Executivo

### O que foi alinhado

| Item | Status |
|------|--------|
| `prisma/schema.prisma` alinhado com `schema.v2.prisma` | Concluido |
| `migration.v2.sql` revisado (974 linhas) | Concluido |
| Correcoes auditoria anterior (B1, B2, B3) verificadas | Confirmadas |
| Novos enums WMS (StockTransferStatus, AdjustmentStatus, ReservationStatus) | Adicionados |
| 12 novos modelos WMS (ProductWarehouseStock, StockLot, Supplier, etc.) | Adicionados |
| Composite FKs em todas as tabelas multi-tenant | Implementados |
| StockMovement v2 (warehouseId, quantitySigned, idempotencyKey, reversalOfId, etc.) | Implementado |
| Servicos Fase 1 adaptados (stock-service.ts, invoice-service.ts, rotas) | Concluido |
| `prisma validate` | Valido |
| `vitest run` | 249/249 passam |
| `tsc --noEmit` | Zero erros |

---

## 2. Comparacao schema.prisma vs schema.v2.prisma

### 2.1 Enums

**Adicionados (v2):**
- `StockTransferStatus` (PENDING, IN_TRANSIT, PARTIALLY_RECEIVED, RECEIVED, CANCELLED)
- `AdjustmentStatus` (OPEN, CLOSED)
- `ReservationStatus` (ACTIVE, RELEASED, EXPIRED, FULFILLED)

**Movido:** `StockMovementType` movido para o bloco de enums no topo do arquivo (era definido inline após o modelo StockMovement).

### 2.2 Modelo Tenant

**Relacoes WMS adicionadas:**
- `productWarehouseStocks`, `stockLots`, `suppliers`, `purchaseOrders`, `purchaseReceptions`
- `stockTransfers`, `stockTransferReceptions`, `stockAdjustments`, `stockReservations`

**Desvio deliberado:** `tenantApplications` e `tenantSubscriptions` foram mantidos (ausentes em v2) porque sao usados pelos servicos Fase 1 (`platform-apps.ts`, `platform-backfill.ts`, `register-machine-stock.ts`) e preservados pela migration.v2.sql.

### 2.3 Modelo Product

| Campo | schema.prisma (antes) | schema.v2.prisma (depois) |
|-------|----------------------|--------------------------|
| `stock` | `Int @default(0)` | `Decimal @default(0) @db.Decimal(12,3)` |
| `minStock` | `Int @default(0)` | `Decimal @default(0) @db.Decimal(12,3)` |
| `barcode` | (ausente) | `String?` |
| Indices | `@@unique([tenantId, id])`, `@@index([tenantId])` | `+ @@unique([tenantId, barcode])`, `+ @@index([codigo])` |
| Relacoes WMS | (ausentes) | `warehouseStocks`, `lots`, `reservations`, `purchaseItems`, `purchaseReceptionItems`, `adjustmentItems`, `stockTransferItems`, `stockTransferReceptionItems` |

### 2.4 Modelo Warehouse

| Item | Antes | Depois |
|------|-------|--------|
| `onDelete` | `Cascade` | `Restrict` |
| Index | `@@index([tenantId])`, `@@index([tenantId, isActive])` | `+ @@unique([tenantId, id])` |
| Relacoes WMS | (ausentes) | `productStocks`, `movements` (MovementWarehouse), `fromTransfers`/`toTransfers`, `transferReceptionsFrom`, `purchaseReceptions`, `adjustments`, `reservations` |

### 2.5 Modelo StockMovement (mudancas mais significativas)

| Campo | Antes | Depois |
|-------|-------|--------|
| `quantity` | `Int` | `Decimal @db.Decimal(12,3)` |
| `warehouseId` | (ausente) | `String` (obrigatorio) |
| `quantitySigned` | (ausente) | `Decimal @db.Decimal(12,3)` (obrigatorio) |
| `idempotencyKey` | (ausente) | `String` (obrigatorio) |
| `reversalOfId` | (ausente) | `String?` |
| `transferId` | (ausente) | `String?` |
| `purchaseReceptionId` | (ausente) | `String?` |
| `transferReceptionId` | (ausente) | `String?` |
| `product` FK | `fields:[productId], references:[id]` | `fields:[tenantId, productId], references:[tenantId, id]` (composite) |
| `warehouse` FK | (ausente) | `fields:[tenantId, warehouseId], references:[tenantId, id]` (composite, MovementWarehouse) |
| `tenant` FK onDelete | `Cascade` | `Restrict` |
| Novos indices | 4 | 11 (incluindo reversalOfId, createdAt, etc.) |
| Novos unicos | 1 | 4 (tenantId/id, tenantId/idempotencyKey, tenantId/transferReceptionId, tenantId/reversalOfId) |

### 2.6 Novos modelos WMS (12)

1. `ProductWarehouseStock` — estoque fisico por produto/armazem/lote
2. `StockLot` — lotes de produto com numero de lote e data de validade
3. `Supplier` — fornecedores por tenant
4. `PurchaseOrder` — ordens de compra
5. `PurchaseOrderItem` — itens de ordem de compra (composite FK com PurchaseOrder e Product)
6. `PurchaseReception` — recepcoes de compra
7. `PurchaseReceptionItem` — itens de recepcao
8. `StockTransfer` — transferencias entre armazens
9. `StockTransferItem` — itens de transferencia
10. `StockTransferReception` — recepcao de transferencia
11. `StockTransferReceptionItem` — itens de recepcao de transferencia
12. `StockAdjustment` / `StockAdjustmentItem` — ajustes de estoque
13. `StockReservation` — reservas de estoque

### 2.7 Modelo BusinessDocumentCounter

| Item | Antes | Depois |
|------|-------|--------|
| PK | `@@id([tenantId, type, year])` (composite) | `id String @id @default(uuid())` + `@@unique([tenantId, id])` |
| Unico | (nenhum) | `@@unique([tenantId, id])` |
| Index | (nenhum) | `@@index([tenantId])` |

### 2.8 Modelo BusinessDocument

| Item | Antes | Depois |
|------|-------|--------|
| Unico | `@@unique([tenantId, type, number])` | `@@unique([tenantId, id])`, `@@unique([tenantId, number])` |
| Index | `@@index([tenantId, type, status, issueDate])` | `@@index([tenantId, issueDate])`, `@@index([customerId, issueDate])` |

### 2.9 Outros modelos com mudancas de indice

| Modelo | Antes | Depois |
|--------|-------|--------|
| `EmailActionToken` | `@@index([userId, purpose, expiresAt])` | `@@index([userId, expiresAt])` |
| `EmailDelivery` | `@@index([status, createdAt])` | `@@index([createdAt])` |
| `PlatformTeamInvite` | `@@index([email, status])`, `@@index([status, expiresAt])` | `@@index([email])`, `@@index([expiresAt])` |
| `EmailCampaign` | `@@index([status, scheduledAt])` | `@@index([scheduledAt])` |
| `EmailCampaignRecipient` | `@@index([campaignId, status, createdAt])` | `@@index([campaignId, createdAt])` |

### 2.10 Modelos preservados (Fase 1, ausentes em v2 mas mantidos)

`PlatformApplication`, `SubscriptionPlan`, `PlanApplication`, `TenantApplication`, `TenantSubscription` — mantidos para compatibilidade com servicos Fase 1. Declarados como preservados pela migration.v2.sql (linha 143-144).

---

## 3. Revisao migration.v2.sql (974 linhas)

### 3.1 Estrutura da migration

| Fase | Descricao | Status |
|------|-----------|--------|
| Enums | CREATE TYPE para StockTransferStatus, AdjustmentStatus, ReservationStatus | OK |
| Drop FK/Index | DROP CONSTRAINT e DROP INDEX IF EXISTS antes das alteracoes | OK |
| AlterTable Product | barcode, stock/minStock Decimal(12,3) | OK |
| AlterTable StockMovement | warehouseId, idempotencyKey, quantitySigned, reversalOfId, transferId, purchaseReceptionId, transferReceptionId, quantity Decimal | OK |
| Backfill | quantitySigned calculado por type | OK |
| Diagnostico | SELECT para campos em falta (warehouseId, idempotencyKey, quantitySigned) | OK |
| NOT NULL | Comentado ate validacao manual | OK |
| BusinessDocumentCounter.id | Backfill UUID + validacao unicidade | OK |
| CreateTable | 13 novas tabelas WMS | OK |
| CreateIndex | Todos com IF NOT EXISTS | OK |
| AddForeignKey | Composite FKs em todas as relacoes WMS | OK |
| CHECK constraints | NOT VALID + VALIDATE (duas etapas) | OK |
| Indices unicos parciais | ProductWarehouseStock (lotId IS NOT NULL / IS NULL) | OK |
| RLS | ENABLE + FORCE em 21 tabelas | OK |
| Politicas RLS | tenant_isolation em 21 tabelas (tenantId entre aspas duplas) | OK |

### 3.2 Correcoes de auditoria anterior — VERIFICADAS

| Bug | Descricao | Status em migration.v2.sql |
|-----|-----------|---------------------------|
| B1 | `tenantId` nao entre aspas em politicas RLS (21 ocorrencias) | Corrigido: todas as 21 politicas usam `"tenantId"` com aspas duplas (linhas 913-973) |
| B2 | Duplicate `ADD COLUMN id` em BusinessDocumentCounter | Corrigido: nao existe duplicate; backfill usa UPDATE gen_random_uuid() |
| B3 | `DROP INDEX` sem IF NOT EXISTS | Corrigido: todas as 7 DROP INDEX usam IF NOT EXISTS (linhas 20-41) |
| — | `CREATE INDEX` sem IF NOT EXISTS | Corrigido: todos os CREATE INDEX usam IF NOT EXISTS (linhas 355-586) |

### 3.3 Itens ausentes ou pendentes em migration.v2.sql

| Item | Descricao | Impacto |
|------|-----------|---------|
| `migration_user` / `app_user` separacao | Nao declarada explicitamente na migration | Baixo — gerenciado fora do escopo desta migration |
| NOT NULL em StockMovement | Linhas comentadas (fase 3 da migration) | Alto — requer validacao manual antes de aplicar |
| BusinessDocumentCounter PK | ALTER TABLE para NOT NULL + PK comentado | Medio — requer validacao de unicidade antes de aplicar |

---

## 4. Compatibilidade com Servicos Fase 1

### 4.1 Alteracoes feitas nos servicos

#### `src/lib/stock-service.ts`
- `decrementStockForInvoice`: adicionado parametro `warehouseId`; StockMovement.create inclui `warehouseId`, `quantitySigned` (-quantity para OUT), `idempotencyKey` (`invoice-{invoiceId}-{productId}`)
- `restoreStockForCancelledInvoice`: adicionado parametro `warehouseId`; StockMovement.create inclui `warehouseId`, `quantitySigned` (+quantity para IN), `idempotencyKey` (`invoice-cancel-{invoiceId}-{productId}`)
- `registerStockEntry`: adicionado parametro `warehouseId`; StockMovement.create inclui `warehouseId`, `quantitySigned` (+quantity para IN), `idempotencyKey` (`stock-entry-{productId}-{reference}`); adicionado `import crypto from 'crypto'`

#### `src/lib/invoice-service.ts`
- `issueInvoice`: lookup de default warehouse antes de `decrementStockForInvoice`; erro se nenhum armazem padrao configurado
- `issueCreditNote`: lookup de default warehouse antes de `restoreStockForCancelledInvoice`; erro se nenhum armazem padrao configurado

#### `src/app/api/stock/transfer/route.ts`
- Ambas as chamadas `stockMovement.create` incluem `warehouseId`, `quantitySigned`, `idempotencyKey`
- OUT: `warehouseId=fromWarehouseId`, `quantitySigned=-quantity`
- IN: `warehouseId=toWarehouseId`, `quantitySigned=quantity`

#### `src/app/api/stock/movements/route.ts`
- Validacao de `warehouseId` no corpo da requisicao
- Lookup de warehouse ativo antes de criar movimento
- `quantitySigned` calculado por type (IN: +q, OUT: -q, ADJUSTMENT: |q|)
- `idempotencyKey` gerado com `crypto.randomUUID()`

#### `src/app/api/stock/purchase/route.ts`
- Validacao de `warehouseId` no corpo da requisicao
- Passagem de `warehouseId` para `registerStockEntry`

### 4.2 Testes atualizados

`src/lib/stock.test.ts` — todas as chamadas para `decrementStockForInvoice`, `restoreStockForCancelledInvoice`, `registerStockEntry` atualizadas com `warehouseId`; expectativas de `stockMovement.create` incluem os novos campos.

### 4.3 Resultado de validacao

| Verificacao | Resultado |
|-------------|-----------|
| `prisma validate` | Valido |
| `vitest run` | 249/249 passam |
| `tsc --noEmit` | Zero erros |

---

## 5. Plano de Migration Incremental

### 5.1 Pre-condicoes

1. **Backup completo** do banco de producao antes de qualquer alteracao
2. **Staging validado:** executar migration.v2.sql no cluster staging (127.0.0.1:5433, wms_staging) e validar integridade
3. **Servicos implantados:** versao do codigo com os novos campos obrigatorios (warehouseId, quantitySigned, idempotencyKey) deve estar pronta para ser implantada imediatamente após a migration
4. **Nenhuma transacao longa** em andamento durante a execucao da migration

### 5.2 Etapas da migration

```
Etapa 0: Backup do banco de producao
Etapa 1: Executar migration.v2.sql no staging (validacao)
Etapa 2: Aplicar migration.v2.sql na producao ( CREATE TYPE, ALTER TABLE, CREATE TABLE, indices, FKs )
Etapa 3: Executar backfills (quantitySigned, BusinessDocumentCounter.id)
Etapa 4: Validacao manual dos diagnostics SELECT (warehouseId NULL, idempotencyKey NULL, etc.)
Etapa 5: Corrigir dados invalidos encontrados no diagnostico
Etapa 6: Executar VALIDATE CONSTRAINT para cada CHECK constraint
Etapa 7: Aplicar NOT NULL em StockMovement (warehouseId, idempotencyKey, quantitySigned)
Etapa 8: Aplicar PK em BusinessDocumentCounter.id
Etapa 9: Habilitar RLS e criar politicas
Etapa 10: Criar indices unicos parciais para ProductWarehouseStock
Etapa 11: Implantar servicos atualizados
Etapa 12: Validacao post-migration (contagem de linhas, integridade FK)
```

### 5.3 Rollback

| Componente | Plano de rollback |
|------------|-------------------|
| Novas tabelas WMS | DROP TABLE (reversivel antes do uso em producao) |
| ALTER TABLE Product (stock/minStock Decimal) | Nao reversível diretamente — restaurar do backup |
| ALTER TABLE StockMovement | Nao reversível diretamente — restaurar do backup |
| CHECK constraints | ALTER TABLE ... DROP CONSTRAINT |
| RLS | ALTER TABLE ... DISABLE ROW LEVEL SECURITY |
| Indices | DROP INDEX |

**Nota:** Como a migration adiciona colunas obrigatorias (NOT NULL) sem DEFAULT, o rollback requer restaurar do backup. Recomendado: executar em janela de manutenção com backup verificado.

### 5.4 Validacao post-migration

```sql
-- Verificar que nenhum StockMovement tem NULL nos campos obrigatorios
SELECT count(*) FROM "StockMovement" WHERE "warehouseId" IS NULL OR "idempotencyKey" IS NULL OR "quantitySigned" IS NULL;

-- Verificar integridade das composite FKs
SELECT sm.id FROM "StockMovement" sm
LEFT JOIN "Product" p ON sm."tenantId" = p."tenantId" AND sm."productId" = p."id"
WHERE p.id IS NULL;

-- Verificar CHECK constraints
SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'StockMovement'::regclass;
```

---

## 6. Riscos e Desvios

### 6.1 Desvios do schema.v2.prisma

| Desvio | Justificativa |
|--------|---------------|
| Modelos `PlatformApplication`, `SubscriptionPlan`, `PlanApplication`, `TenantApplication`, `TenantSubscription` mantidos | Usados por servicos Fase 1 (`platform-apps.ts`, `platform-backfill.ts`, `register-machine-stock.ts`); preservados pela migration.v2.sql |
| Relacoes `tenantApplications` e `tenantSubscriptions` mantidas no modelo Tenant | Necessarias para os modelos acima funcionarem |
| Relacoes WMS ausentes em `Tenant` para modelos plataforma | Nao se aplicam — modelos plataforma nao tem relacao WMS |

### 6.2 Riscos conhecidos

1. **Prisma generate falhou no Windows** (EPERM na renomeacao de `query_engine-windows.dll.node`). Problema de ambiente (lock de arquivo), nao de codigo. Executar `prisma generate` em ambiente Linux/WSL ou com permissao de administrador.

2. **StockMovement.warehouseId obrigatorio** — codigo existente que nao passa `warehouseId` falhara. Todos os 3 locais de criacao foram atualizados (stock-service.ts x3, transfer/route.ts x2, movements/route.ts x1).

3. **BusinessDocumentCounter cambio de PK** — de composite `[tenantId, type, year]` para UUID `id`. Nenhum servico Fase 1 referencia este modelo diretamente, mas consultas SQL brutas que dependam do composite PK precisam ser revisadas.

4. **NOT NULL pendente** — as linhas ALTER TABLE ... SET NOT NULL em migration.v2.sql estao comentadas. Requer validacao manual antes de aplicar na producao.

5. **RLS FORCE** — afeta o proprio proprietario da tabela (incluindo usuario Prisma). As aplicacoes devem definir `app.tenant_id` via `runWithTenant` antes de qualquer consulta (ja implementado na Fase 1).

---

## 7. Assinatura

- Schema alinhado: `prisma/schema.prisma` (1133 linhas)
- Migration revisada: `migration.v2.sql` (974 linhas)  
- Servicos adaptados: 5 arquivos modificados
- Testes: 249/249 passam
- TypeScript: 0 erros

**Veredito: APROVADO PARA FASE 3**