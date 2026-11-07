# Auditoria Técnica — Módulo Armazéns/WMS

**Projeto:** Machine Facturas  
**Caminho:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Data:** 2026-11-03  
**Auditor:** Kilo  
**Restrições respeitadas:** Nenhum ficheiro modificado, nenhuma migration executada, BD inalterado, sem dados de teste, sem commits/pushes

---

## 1. Estado Atual do Módulo WMS

### 1.1 Modelos existentes no `prisma/schema.prisma`

| Modelo | Linha | Estado | Problemas |
|--------|-------|--------|-----------|
| `Warehouse` | 214 | Existe | Sem `@@unique([tenantId, id])`, sem composite FK, sem relação `productStocks` |
| `StockMovement` | 229 | Existe | `quantity` é `Int` (não `Decimal`), sem `warehouseId`, sem `idempotencyKey`, sem reversal, sem composite FK para `Product` |
| `Product` | 194 | Existe | `stock` e `minStock` são `Int` (devem ser `Decimal` para WMS profissional), sem relação com armazéns |

### 1.2 Modelos WMS em falta (não existem)

Os seguintes modelos essenciais para um WMS profissional **não existem** no schema:

- `ProductWarehouseStock` — stock por produto/armazém/lote
- `StockLot` — rastreabilidade por lote com data de validade
- `Supplier` — fornecedores
- `PurchaseOrder` / `PurchaseOrderItem` — ordens de compra
- `PurchaseReception` / `PurchaseReceptionItem` — receções de compra
- `StockTransfer` / `StockTransferItem` — transferências entre armazéns
- `StockTransferReception` / `StockTransferReceptionItem` — receção de transferências
- `StockAdjustment` / `StockAdjustmentItem` — ajustes de inventário
- `StockReservation` — reservas de stock para documentos

### 1.3 Enumerações existentes

- `StockMovementType` (IN, OUT, ADJUSTMENT) — existe na linha 247

---

## 2. Descoberta Chave: Prisma Suporta Composite FKs

Durante esta auditoria, foi testado e **confirmado** que o Prisma 5.22.0 suporta **chaves estrangeiras compostas** (`fields: [tenantId, X], references: [tenantId, id]`). Esta foi uma suposição incorreta anterior.

**Requisito para composite FK no Prisma:** o modelo referenciado deve ter `@@unique([tenantId, id])`.

**Validação:** O schema proposto em `test_composite.prisma` e `schema.prisma` (diretório temporário de auditoria) valida sem erros com `prisma validate`.

---

## 3. Arquitetura Proposta — WMS Profissional Multi-Tenant

### 3.1 Princípios de Integridade

Todos os modelos WMS usam **chave estrangeira composta** `[tenantId, id]` para garantir isolamento físico por tenant ao nível da base de dados PostgreSQL, complementando o isolamento lógico via `runWithTenant` / `app.tenant_id`.

### 3.2 Modelo de Dados (14 modelos WMS)

```
Tenant ──┬── Warehouse ──┬── ProductWarehouseStock ──┬── StockLot
         │               │                           │
         │               └── Product ──┬── StockLot  │
         │                             │             │
         │                             └── StockReservation
         │
         ├─ Supplier ── PurchaseOrder ── PurchaseOrderItem ── Product
         │                                │                    │
         │                                └── PurchaseReceptionItem
         │                                         │
         └─ PurchaseReception ── PurchaseReceptionItem ── StockLot
                                      │
                                      └── StockMovement
         │
         ├─ StockTransfer ── StockTransferItem ── Product
         │               │                    │
         │               └── StockTransferReceptionItem
         │                                      │
         └─ StockTransferReception ── StockTransferReceptionItem ── StockLot
                                              │
                                              └── StockMovement
         │
         ├─ StockAdjustment ── StockAdjustmentItem ── ProductWarehouseStock
         │               │
         └─ StockReservation ── ProductWarehouseStock
         │
         └── StockMovement (reversalOf, transfer, purchaseReception, transferReception)
```

### 3.3 Índices Únicos Parciais (SQL nativo — Prisma não suporta)

O Prisma **não suporta** `NULLS NOT DISTINCT` em `@@unique`. Para garantir unicidade de `(tenantId, productId, warehouseId, lotId)` quando `lotId IS NOT NULL`, e unicidade de `(tenantId, productId, warehouseId)` quando `lotId IS NULL`, são necessários índices parciais PostgreSQL:

```sql
CREATE UNIQUE INDEX "ProductWarehouseStock_tenantId_productId_warehouseId_lotId_key"
  ON "ProductWarehouseStock"("tenantId", "productId", "warehouseId", "lotId")
  WHERE "lotId" IS NOT NULL;

CREATE UNIQUE INDEX "ProductWarehouseStock_tenantId_productId_warehouseId_no_lot_key"
  ON "ProductWarehouseStock"("tenantId", "productId", "warehouseId")
  WHERE "lotId" IS NULL;
```

Estão incluídos no ficheiro `migration.sql` do diretório temporário de auditoria.

---

## 4. Ficheiros de Auditoria (diretório temporário, não no projeto)

| Ficheiro | Conteúdo |
|----------|----------|
| `schema.prisma` | Schema Prisma completo com todos os modelos WMS, composite FKs, `@@unique([tenantId, id])` em todos os modelos referenciados |
| `migration.sql` | SQL DDL completo gerado por `prisma migrate diff` (diff entre schema atual e proposto) + índices parciais manuais |
| `test_composite.prisma` | Schema mínimo usado para validar suporte a composite FKs no Prisma 5.22.0 |

**Localização temporária:** `C:\Users\ADMINI~1\AppData\Local\Temp\kilo\wms_audit/`

**Não foram copiados para o projeto** (respeitando a restrição de não modificar ficheiros).

---

## 5. Lacunas de Implementação (Camada de Aplicação)

Para além do schema, os seguintes componentes de aplicação estão em falta ou são insuficientes:

| Componente | Estado | Necessário |
|------------|--------|------------|
| Service layer WMS | Inexistente | `src/lib/wms/` com services para stock, lotes, transferências, ajustes |
| API Routes WMS | `/warehouses` existe (visualização básica) | POST/PATCH/DELETE para armazéns, endpoints para stock, lotes, transferências, receções |
| Validação de stock | Inexistente | Verificar `quantity >= 0` antes de saídas, `reservedQuantity <= quantity` |
| Idempotência | Parcial (apenas Invoice/Payment) | `idempotencyKey` em `StockMovement` para evitar duplicação de movimentos |
| Reversão de movimentos | Inexistente | Campo `reversalOfId` em `StockMovement` para estornos |
| Rastreabilidade por lote | Inexistente | `StockLot` + `lotId` em `ProductWarehouseStock` |
| Reservas de stock | Inexistentes | `StockReservation` para bloquear stock em documentos em rascunho |

---

## 6. Recomendações de Implementação

### Fase 1 — Schema e Migration
1. Executar `migration.sql` (ou equivalente via Prisma Migrate) para criar as 13 novas tabelas e alterar `Product`, `StockMovement`, `Warehouse`
2. Aplicar índices parciais para unicidade de stock com/sem lote

### Fase 2 — Camada de Dados (Prisma)
1. Atualizar `prisma/schema.prisma` com os modelos WMS (usar o schema validado como referência)
2. Executar `prisma generate` para atualizar o Prisma Client
3. Adicionar `@@unique([tenantId, id])` a `Warehouse` (já tem em `Product`)

### Fase 3 — Services de Domínio
1. `StockService`: entrada/saída de stock, movimentação, ajuste, reversão
2. `LotService`: criação de lotes, validação de validade, FIFO/FEFO
3. `TransferService`: transferências entre armazéns com estados PENDING → IN_TRANSIT → RECEIVED
4. `ReservationService`: reservar/liberar stock para documentos (faturas, ordens de compra)
5. `ReceptionService`: receção de compras e transferências, atualização de stock e lotes

### Fase 4 — API e UI
1. Endpoints REST para cada entidade WMS
2. Páginas de gestão de armazéns, stock, lotes, transferências, ajustes
3. Dashboard de inventário com alertas de stock mínimo

---

## 7. Próximos Passos Sugeridos

1. Revisar o schema em `schema.prisma` (diretório temporário de auditoria) e adaptar para `prisma/schema.prisma` do projeto
2. Executar `prisma migrate dev` (em ambiente de desenvolvimento com DB local) para criar as migration files
3. Implementar os services de domínio WMS
4. Criar as API routes e páginas de UI
5. Escrever testes para os serviços de stock e transferências

---

**Nota:** Nenhum ficheiro do projeto foi modificado durante esta auditoria. Todos os artefacts de auditoria estão em diretório temporário fora do workspace.