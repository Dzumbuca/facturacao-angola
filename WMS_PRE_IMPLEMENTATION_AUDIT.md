# WMS Pre-Implementation Audit — Machine Facturas

**Projeto:** Machine Facturas  
**Diretório:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Data:** 2026-11-03  
**Auditor:** Kilo (software engineering audit)  
**Contexto:** Arquitetura WMS v2 aprovada em staging. Migration executada em staging limpo sem erros. 13 grupos de teste aprovados. Projeto original ainda NÃO modificado.  
**Escopo:** Auditoria técnica de código apenas leitura. Nenhum ficheiro alterado. Nenhuma migration executada. Nenhuma ligação à produção.

---

## 1. Resumo Executivo

O projeto Machine Facturas possui uma camada de stock básica já implementada (StockMovement, Warehouse, stock-service.ts, rotas de API de stock) que está integrada com a faturação via `issueInvoice` (baixa automática) e `issueCreditNote` (estorno). No entanto, existem **problemas críticos** que impedem a implementação segura do WMS v2 sem alterações prévias:

1. **`issueCreditNote` não usa transação** — cria nota de crédito, atualiza fatura original e restaura stock como 3 operações separadas fora de qualquer transacção. Risco de inconsistencia parcial se falhar no meio.
2. **`restoreStockForCancelledInvoice` chamado sem `tx`** em `issueCreditNote` — recai para o cliente Prisma global, sem contexto de RLS (`app.tenant_id`), sem atomicidade.
3. **`decrementStockForInvoice` e `restoreStockForCancelledInvoice` fazem fallback para `prisma` global** quando nenhum `tx` é fornecido, permitindo chamadas sem transacção e sem RLS.
4. **Funções de leitura de stock (`getLowStockAlerts`, `getStockValuationReport`, `getStockRotationReport`) usam `prisma` global diretamente** — sem `runWithTenant`, sem contexto RLS, vulnerável a leitura cross-tenant se RLS for activado no futuro.
5. **Várias rotas de API usam `prisma` global sem `runWithTenant`** (ex: `stock/warehouses/[id]/route.ts` linhas 15 e 45).
6. **`route-access.ts` não inclui `/warehouses` nem `/stock`** — páginas WMS não protegidas.
7. **Schema atual é incompatível com `schema.v2.prisma`** — requer migration (já validada em staging) antes de qualquer código WMS v2.

**Parecer preliminar:** REPROVADO PARA IMPLEMENTAÇÃO direta. Requer correções nos itens críticos acima antes de iniciar a implementação do WMS v2.

---

## 2. Arquitetura Atual Identificada

### 2.1 Stack Tecnológica
- Next.js (App Router), TypeScript, Prisma ORM, PostgreSQL
- NextAuth.js para autenticação (sessão JWT)
- `prisma` como cliente singleton global (`src/lib/prisma.ts`)
- `runWithTenant` (`src/lib/tenant-db.ts`) para definir `app.tenant_id` dentro de transacções Prisma

### 2.2 Modelos Relevantes ao Stock (prisma/schema.prisma)

| Modelo | Campos-chave | Observações |
|--------|-------------|-------------|
| `Product` | `id`, `tenantId`, `stock` (Int, default 0), `minStock`, `categoria` | Fonte atual de stock; sem relação com armazém |
| `Warehouse` | `id`, `tenantId`, `name`, `isDefault`, `isActive` | Modelo básico, sem ligação a produtos ou movimentos |
| `StockMovement` | `id`, `tenantId`, `productId`, `type` (IN/OUT/ADJUSTMENT), `quantity`, `reason`, `reference`, `createdByUserId`, `createdAt` | Sem `warehouseId`, sem `quantitySigned`, sem `idempotencyKey`, sem `reversalOfId` |
| `Invoice` / `InvoiceItem` | Fatura com itens; `InvoiceItem.productId`, `quantity` | Integração com stock via `decrementStockForInvoice` |
| `StockMovementType` | enum: IN, OUT, ADJUSTMENT | Sem conceito de sinal explícito |

### 2.3 runWithTenant (src/lib/tenant-db.ts)

```typescript
export async function runWithTenant<T>(tenantId: string, fn: (tx: any) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
```

- Define `app.tenant_id` como configuração de sessão PostgreSQL dentro de uma transacção
- Só tem efeito se existir políticas RLS nas tabelas (ainda não activadas no esquema atual)
- Retorna o `tx` para uso nas operações dentro do callback

### 2.4 Serviços de Stock (src/lib/stock-service.ts)

| Função | Usa `tx`? | Fallback para `prisma` global? | runWithTenant? |
|--------|-----------|-------------------------------|----------------|
| `decrementStockForInvoice` | Opcional (parâmetro `tx?`) | **Sim** (linha 15: `const database = tx || prisma`) | Não |
| `restoreStockForCancelledInvoice` | Opcional (parâmetro `tx?`) | **Sim** (linha 60: `const database = tx || prisma`) | Não |
| `registerStockEntry` | Sim (dentro de `runWithTenant`) | Não | Sim |
| `getLowStockAlerts` | Não | **Sim** (linha 124: `prisma.product.findMany`) | Não |
| `getStockValuationReport` | Não | **Sim** (linha 146: `prisma.product.findMany`) | Não |
| `getStockRotationReport` | Não | **Sim** (linha 184: `prisma.stockMovement.findMany`) | Não |

### 2.4 Serviço de Faturação (src/lib/invoice-service.ts)

| Função | Transação? | Uso de `tx` para stock? |
|--------|-----------|------------------------|
| `issueInvoice` | Sim (`prisma.$transaction`) | Passa `transaction` para `decrementStockForInvoice` — **OK** |
| `issueCreditNote` | **Não** (nenhuma transacção) | Chama `restoreStockForCancelledInvoice` **sem `tx`** — **CRÍTICO** |

### 2.5 Rotas de API de Stock

| Rota | Método | Usa `runWithTenant`? | Observações |
|------|--------|---------------------|-------------|
| `/api/stock` | GET | Sim | Movimentos dentro de tx |
| `/api/stock/movements` | GET | Sim | Dentro de tx |
| `/api/stock/movements` | POST | Sim | `updateMany` com `stock: { gte: quantity }` — atómico |
| `/api/stock/movements/[id]` | DELETE | Não (apenas verificação, bloqueado) | Desactivado por consistência |
| `/api/stock/purchase` | POST | Indirecto (via `registerStockEntry` que usa `runWithTenant`) | OK |
| `/api/stock/transfer` | POST | Sim | Lê `product.stock` antes de criar movimentos (não atómico) |
| `/api/stock/warehouses` | GET/POST | Sim | OK |
| `/api/stock/warehouses/[id]` | PATCH | Sim (linha 21) | OK |
| `/api/stock/warehouses/[id]` | DELETE | **Não** (linha 15, 45 usam `prisma` global) | **PROBLEMA** |
| `/api/stock/alerts` | GET | Indirecto (via `getLowStockAlerts` que usa `prisma` global) | **PROBLEMA** |
| `/api/stock/report` | GET | Indirecto (via `getStockValuationReport`/`getStockRotationReport` que usam `prisma` global) | **PROBLEMA** |

### 2.6 Controlo de Acesso (src/lib/route-access.ts)

```typescript
export const isProtectedPagePath = (pathname) =>
  pathname === '/' ||
  pathname === '/documentos' || pathname.startsWith('/documentos/') ||
  pathname === '/pagamento' ||
  pathname.startsWith('/reports/') || pathname === '/reports' ||
  pathname === '/produtos' || pathname.startsWith('/produtos/') ||
  pathname === '/empresa' || pathname.startsWith('/empresa/') ||
  pathname.startsWith('/customers/') || pathname === '/customers' ||
  pathname.startsWith('/invoices/') || pathname === '/invoices' ||
  pathname.startsWith('/products/') || pathname === '/products';
```

- **Não inclui `/warehouses` nem `/stock`** — páginas WMS não protegidas por autenticação
- Roles de tenant: `USER`, `COMPANY_ADMIN`, `BILLING`, `VIEWER` (definidas no schema Prisma)

---

## 3. Problemas Identificados

### 3.1 Críticos

| ID | Problema | Localização | Impacto |
|----|----------|-------------|---------|
| **C1** | `issueCreditNote` executa sem transacção — 3 operações separadas (criar crédito, atualizar fatura, restaurar stock) | `src/lib/invoice-service.ts:271-403` | Inconsistencia parcial se falhar no meio; stock pode ficar desalinhado com fatura |
| **C2** | `restoreStockForCancelledInvoice` chamado sem `tx` em `issueCreditNote` — recai para `prisma` global | `src/lib/invoice-service.ts:391-396` | Sem contexto RLS (`app.tenant_id`); sem atomicidade; permite operação cross-tenant se RLS activado |
| **C3** | `decrementStockForInvoice` e `restoreStockForCancelledInvoice` fazem fallback para `prisma` global quando `tx` não fornecido | `src/lib/stock-service.ts:15,60` | Chamadas sem transacção e sem RLS são possíveis acidentalmente |
| **C4** | `getLowStockAlerts`, `getStockValuationReport`, `getStockRotationReport` usam `prisma` global sem `runWithTenant` | `src/lib/stock-service.ts:124,146,184` | Leitura sem contexto de tenant; vulnerável a cross-tenant se RLS for activado |
| **C5** | `stock/warehouses/[id]/route.ts` usa `prisma.warehouse.findFirst` global (linhas 15, 45) sem `runWithTenant` | `src/app/api/stock/warehouses/[id]/route.ts` | Leitura/eliminação sem contexto RLS |

### 3.2 Altos

| ID | Problema | Localização | Impacto |
|----|----------|-------------|---------|
| **H1** | `stock/transfer` lê `product.stock` e depois cria movimentos (não atómico) — risco de overselling em concorrência | `src/app/api/stock/transfer/route.ts:34-42` | Dois transfers simultâneos podem exceder stock disponível |
| **H2** | `decrementStockForInvoice` itera produtos fazendo `findFirst` + `update` separadamente — não usa `updateMany` com condição de stock suficiente | `src/lib/stock-service.ts:25-47` | Não valida stock suficiente antes de decrementar; pode criar stock negativo |
| **H3** | `issueInvoice` faz leituras pré-transacção com `prisma` global (tenant, customer, lastInvoice, invoiceCount) antes de entrar no `$transaction` | `src/lib/invoice-service.ts:16-90` | Condição de corrida na geração do número de fatura entre leitura e escrita |
| **H4** | `issueCreditNote` não valida se o stock pode ser restaurado (não verifica se produto existe, não usa `updateMany` com condição) | `src/lib/invoice-service.ts:391-396` | Restaurar stock para produto inexistente falha silenciosamente (continua o loop) |

### 3.3 Médios

| ID | Problema | Localização | Impacto |
|----|----------|-------------|---------|
| **M1** | `StockMovement` não tem `warehouseId`, `quantitySigned`, `idempotencyKey`, `reversalOfId` | `prisma/schema.prisma:229-245` | Incompatível com schema.v2.prisma; requer migration antes do WMS v2 |
| **M2** | `Product.stock` é `Int`; schema.v2 usa `Decimal` | `prisma/schema.prisma:202` vs `schema.v2.prisma:257` | Alteração de tipo requer migration de dados |
| **M3** | `StockMovement.product` FK simples; v2 requer composite FK `(tenantId, productId)` | `prisma/schema.prisma:239` vs `schema.v2.prisma:636` | Risco de referência cross-tenant sem composite FK |
| **M4** | `route-access.ts` não protege `/warehouses` nem `/stock` | `src/lib/route-access.ts:1-13` | Páginas WMS acessíveis sem autenticação |
| **M5** | `StockMovement.type` é `OUT` para transferência de saída; não há sinal explícito de quantidade | `prisma/schema.prisma:233` | Dificulta reconciliação e relatórios; v2 adiciona `quantitySigned` |

### 3.4 Baixos

| ID | Problema | Localização | Impacto |
|----|----------|-------------|---------|
| **L1** | `register-machine-stock.ts` registra aplicação mas não há middleware que verifique `TenantApplication.enabled` para rotas de stock | `src/lib/register-machine-stock.ts` | Aplicação "machine-stock" pode não estar activa para o tenant |
| **L2** | Nenhum índice único parcial para impedir duplicação de `idempotencyKey` em `StockMovement` | `prisma/schema.prisma:242-244` | v2 adiciona `@@unique([tenantId, idempotencyKey])` |
| **L3** | `StockMovement` não tem `transferId`, `purchaseReceptionId`, `transferReceptionId` | `prisma/schema.prisma:229-245` | v2 adiciona estes campos para rastreabilidade |

---

## 4. Mapa dos Pontos de Integração com a Faturação

### 4.1 Fluxo de Emissão de Fatura (`issueInvoice`)

```
1. GET tenant (prisma global)              → src/lib/invoice-service.ts:16
2. GET companyBankAccount (prisma global)  → src/lib/invoice-service.ts:20
3. GET/CREATE customer (prisma global)     → src/lib/invoice-service.ts:59-77
4. GET lastInvoice (prisma global)         → src/lib/invoice-service.ts:80
5. COUNT invoices (prisma global)          → src/lib/invoice-service.ts:88
6. PRISMA $TRANSACTION (início)            → src/lib/invoice-service.ts:211
   6a. SELECT Tenant FOR UPDATE             → linha 213
   6b. COUNT invoices dentro do tx          → linha 220
   6c. claimUnlockForEmission (ad-unlock)   → linha 225
   6d. CREATE invoice (tx.invoice.create)   → linha 228
   6e. decrementStockForInvoice(tx)         → linha 235 (com tx!)
   6f. UPDATE invoiceDraft status           → linha 247
7. PRISMA $TRANSACTION (fim)               → linha 254
8. linkUnlockToInvoice (best-effort, pós-commit) → linha 259
```

**Pontos críticos de integração stock/faturação na emissão:**
- Linha 235: `decrementStockForInvoice(tenant.id, saved.id, invoiceItems, transaction)` — passa `tx` corretamente
- Linhas 231-243: Filtra apenas itens com `productId` e `qty > 0`

### 4.2 Fluxo de Anulação / Nota de Crédito (`issueCreditNote`)

```
1. GET originalInvoice (prisma global, NÃO em tx)   → src/lib/invoice-service.ts:277
2. GET lastDocument (prisma global, NÃO em tx)      → src/lib/invoice-service.ts:302
3. COUNT NC invoices (prisma global, NÃO em tx)     → src/lib/invoice-service.ts:310
4. CREATE creditNote (prisma.global, NÃO em tx)     → src/lib/invoice-service.ts:338
5. UPDATE originalInvoice status='ANULADA' (prisma global, NÃO em tx) → linha 379
6. restoreStockForCancelledInvoice(SEM tx)          → linha 391 ← CRÍTICO
```

**Pontos críticos de integração stock/faturação na anulação:**
- Linha 391: `restoreStockForCancelledInvoice(originalInvoice.tenantId, originalInvoice.id, itemsToRestore)` — **SEM `tx`**, recai para `prisma` global
- Linhas 378-382: Atualização do status da fatura original fora de qualquer transacção com a criação da nota de crédito
- Não há atomicidade entre criar a nota de crédito, anular a fatura original e restaurar stock

### 4.3 Fluxo de Rascunho → Fatura (`issueInvoiceDraft`)

```
1. GET draft (prisma.global)                              → src/lib/invoice-draft-service.ts:69
2. CHECK existing invoice by sourceDraftId (prisma.global) → linha 71
3. UPDATE draft status='ISSUING' (prisma.global)          → linha 80
4. Chamar issueInvoice(...)                               → linha 84 (usa $transaction internamente)
5. Em caso de erro: UPDATE draft status='DRAFT' (prisma.global) → linha 97
```

---

## 5. Dependências de Product.stock

### 5.1 Leitura de Product.stock

| Local | Linha | Contexto |
|-------|-------|----------|
| `src/app/api/stock/movements/route.ts` | 46-48 | Verifica `stock: { gte: quantity }` antes de decrementar (atómico via `updateMany`) |
| `src/app/api/stock/transfer/route.ts` | 34 | `if (product.stock < quantity) throw new Error('INSUFFICIENT')` — leitura não atómica |
| `src/lib/stock-service.ts` | 124 | `getLowStockAlerts` filtra `stock: { lte: 0 }` |
| `src/lib/stock-service.ts` | 146 | `getStockValuationReport` lê `stock` e `price` para valorização |

### 5.2 Escrita de Product.stock

| Local | Linha | Operação | Contexto |
|-------|-------|----------|----------|
| `src/lib/stock-service.ts` | 34 | `stock: { decrement: movement.quantity }` | `decrementStockForInvoice` (com ou sem `tx`) |
| `src/lib/stock-service.ts` | 67 | `stock: { increment: item.quantity }` | `restoreStockForCancelledInvoice` (com ou sem `tx`) |
| `src/lib/stock-service.ts` | 101 | `stock: { increment: quantity }` | `registerStockEntry` (sempre com `tx` via `runWithTenant`) |
| `src/app/api/stock/movements/route.ts` | 48 | `stock: { decrement: quantity }` | POST movimento OUT (com `tx`) |
| `src/app/api/stock/movements/route.ts` | 54 | `stock: { increment: quantity }` | POST movimento IN/ADJUSTMENT (com `tx`) |

### 5.3 Produtos sem Warehouse

No esquema atual, `Product` não tem relação com `Warehouse`. O stock é um único número por produto por tenant. No WMS v2, o stock passa a ser por produto + armazém (`ProductWarehouseStock`), mantendo `Product.stock` apenas para compatibilidade com a faturação existente.

---

## 6. Estado de runWithTenant e Utilização de tx

### 6.1 runWithTenant — Onde Está Presente

Usado em 8 locais:
1. `src/app/api/stock/route.ts:25` — GET movimentos (OK)
2. `src/app/api/stock/movements/route.ts:12` — GET movimentos (OK)
3. `src/app/api/stock/movements/route.ts:41` — POST movimento (OK)
4. `src/app/api/stock/warehouses/route.ts:12` — GET armazéns (OK)
5. `src/app/api/stock/warehouses/route.ts:27` — POST armazém (OK)
6. `src/app/api/stock/warehouses/[id]/route.ts:21` — PATCH armazém (OK)
7. `src/app/api/stock/warehouses/[id]/route.ts:48` — DELETE armazém (OK, dentro de runWithTenant)
8. `src/lib/stock-service.ts:95` — `registerStockEntry` (OK)

### 6.2 runWithTenant — Onde Está AUSENTE (mas deveria estar)

| Local | Linha | Problema |
|-------|-------|----------|
| `src/app/api/stock/warehouses/[id]/route.ts` | 15 | `prisma.warehouse.findFirst` global |
| `src/app/api/stock/warehouses/[id]/route.ts` | 45 | `prisma.warehouse.findFirst` global |
| `src/lib/stock-service.ts` | 124 | `getLowStockAlerts` usa `prisma.product.findMany` global |
| `src/lib/stock-service.ts` | 146 | `getStockValuationReport` usa `prisma.product.findMany` global |
| `src/lib/stock-service.ts` | 184 | `getStockRotationReport` usa `prisma.stockMovement.findMany` global |
| `src/lib/invoice-service.ts` | 16-90 | `issueInvoice` leituras pré-transacção com `prisma` global |
| `src/lib/invoice-service.ts` | 277-396 | `issueCreditNote` inteira função sem `prisma.$transaction` |

### 6.3 Uso de `tx` vs `prisma` Global em stock-service.ts

```typescript
// Linha 15 — FALLBACK PERIGOSO:
const database = tx || prisma;

// Se chamado sem tx, usa o cliente global sem:
// - Contexto de RLS (app.tenant_id não definido)
// - Atomicidade (cada operação é sua própria transacção)
// - Isolamento de tenant
```

---

## 7. Riscos de Concorrência, Isolamento e Duplicação

### 7.1 Concorrência

| Risco | Local | Severidade | Mitigação atual |
|-------|-------|------------|-----------------|
| Race condition na numeração de fatura | `issueInvoice` linhas 80-90 (leitura pré-tx) | Alto | Nenhuma (leitura fora do tx) |
| Overselling em transferência de stock | `stock/transfer/route.ts:34` (leitura + escrita separada) | Alto | Nenhuma |
| Stock negativo em emissão de fatura | `decrementStockForInvoice` (não valida stock suficiente) | Médio | Nenhuma |
| Dupla emissão com mesmo idempotencyKey | StockMovement sem `idempotencyKey` | Médio | Nenhuma (campo não existe) |
| Emissões concorrentes no limite de quota | `issueInvoice` linha 213 (`SELECT ... FOR UPDATE`) | Baixo | Lock no Tenant dentro do tx |

### 7.2 Isolamento entre Empresas (Tenants)

- **Nível de aplicação:** Todas as consultas filtram por `tenantId` na cláusula `WHERE`. Não há falha conhecida neste nível.
- **Nível de base de dados:** RLS **não está activado** em nenhuma tabela. Não existem políticas RLS criadas. Se `runWithTenant` definir `app.tenant_id` mas não houver políticas RLS, a configuração é inópera.
- **Papéis de base de dados:** Não existem papéis `migration_user` nem `app_user` definidos no esquema atual (apenas o utilizador padrão do Prisma).
- **Vulnerabilidade:** Se RLS for activado no futuro sem corrigir os pontos que usam `prisma` global (C3, C4, C5), as consultas sem contexto `app.tenant_id` poderão ler/escrever dados de outros tenants.

### 7.3 Duplicação de Movimentos

- `StockMovement` não tem campo `idempotencyKey` — não há forma de impedir duplicação de movimentos em re-tentativas.
- `StockMovement` não tem `reversalOfId` — não há rastreabilidade de estornos.
- `StockMovement.type` não tem sinal explícito — `quantity` é sempre positivo; o tipo `OUT` implica negativo mas isso é por convenção, não por constraint.

---

## 8. Rotas e Permissões Necessárias para o Futuro WMS

### 8.1 Rotas Existentes (Stock)

| Rota | Método | Protegida? | runWithTenant? |
|------|--------|------------|----------------|
| `/api/stock` | GET | Sim (via `auth()`) | Sim |
| `/api/stock/movements` | GET | Sim | Sim |
| `/api/stock/movements` | POST | Sim | Sim |
| `/api/stock/movements/[id]` | DELETE | Sim (mas bloqueado) | Não (apenas verificação) |
| `/api/stock/purchase` | POST | Sim (via `getTenantWriteAccess`) | Sim (via `registerStockEntry`) |
| `/api/stock/transfer` | POST | Sim | Sim |
| `/api/stock/warehouses` | GET/POST | Sim | Sim |
| `/api/stock/warehouses/[id]` | PATCH | Sim | Sim |
| `/api/stock/warehouses/[id]` | DELETE | Sim | Sim (dentro de runWithTenant) |
| `/api/stock/alerts` | GET | Sim (via `getTenantReadAccess`) | Não (usa `prisma` global) |
| `/api/stock/report` | GET | Sim (via `getTenantReadAccess`) | Não (usa `prisma` global) |

### 8.2 Rotas em Falta para WMS v2

As seguintes rotas/conceitos do WMS v2 **não existem** no código atual:

- `/api/stock/lots` — gestão de lotes (StockLot)
- `/api/stock/reservations` — reservas de stock (StockReservation)
- `/api/stock/adjustments` — ajustes de inventário (StockAdjustment)
- `/api/suppliers` — fornecedores (Supplier)
- `/api/purchase-orders` — ordens de compra (PurchaseOrder)
- `/api/purchase-receptions` — recepções de compra (PurchaseReception)
- `/api/product-warehouse-stock` — stock por armazém (ProductWarehouseStock)

### 8.3 Páginas em Falta no route-access.ts

`/warehouses` e `/stock` não estão em `isProtectedPagePath`. São necessárias para proteger as páginas frontend do WMS.

### 8.4 Permissões por Role (TenantRole)

Definidas no schema: `USER`, `COMPANY_ADMIN`, `BILLING`, `VIEWER`. Não há aplicação granular destas roles nas rotas de stock — todas as rotas de escrita usam `getTenantWriteAccess` sem distinção de role específica para operações de stock.

---

## 9. Funcionalidades Existentes vs. a Implementar

### 9.1 Já Existente

| Funcionalidade | Estado | Localização |
|---------------|--------|-------------|
| Modelo `StockMovement` (IN/OUT/ADJUSTMENT) | Implementado | `prisma/schema.prisma:229-245` |
| Modelo `Warehouse` (básico) | Implementado | `prisma/schema.prisma:214-227` |
| Campo `Product.stock` | Implementado | `prisma/schema.prisma:202` |
| Baixa de stock na emissão de fatura | Implementado | `issueInvoice` → `decrementStockForInvoice` |
| Restauração de stock na anulação | Implementado (sem transacção) | `issueCreditNote` → `restoreStockForCancelledInvoice` |
| Registo de entrada de stock (compra) | Implementado | `registerStockEntry` |
| Movimento manual de stock (POST /api/stock/movements) | Implementado | `src/app/api/stock/movements/route.ts` |
| Transferência entre armazéns | Implementado (básico) | `src/app/api/stock/transfer/route.ts` |
| Alertas de stock baixo | Implementado | `getLowStockAlerts` |
| Relatório de valorização de stock | Implementado | `getStockValuationReport` |
| Relatório de rotação de stock | Implementado | `getStockRotationReport` |
| `runWithTenant` para contexto RLS | Implementado | `src/lib/tenant-db.ts` |
| Bloqueio de eliminação de movimentos | Implementado (desactivado) | `src/app/api/stock/movements/[id]/route.ts` |

### 9.2 a Implementar (WMS v2)

| Funcionalidade | Status | Modelo v2 | Observações |
|---------------|--------|-----------|-------------|
| `ProductWarehouseStock` (stock por armazém) | A implementar | `ProductWarehouseStock` | Requer migration |
| `StockLot` (rastreabilidade por lote) | A implementar | `StockLot` | Requer migration |
| `StockReservation` (reserva de stock) | A implementar | `StockReservation` | Requer migration |
| `StockTransfer` com status (PENDING/IN_TRANSIT/RECEIVED) | A implementar | `StockTransfer` | Requer migration |
| `StockAdjustment` (ajuste de inventário) | A implementar | `StockAdjustment` | Requer migration |
| `Supplier` (fornecedores) | A implementar | `Supplier` | Requer migration |
| `PurchaseOrder` / `PurchaseReception` | A implementar | `PurchaseOrder`, `PurchaseReception` | Requer migration |
| `StockMovement.warehouseId` (obrigatório) | A implementar | `StockMovement` | Requer migration + backfill |
| `StockMovement.quantitySigned` | A implementar | `StockMovement` | Requer migration + backfill |
| `StockMovement.idempotencyKey` | A implementar | `StockMovement` | Requer migration + índice único |
| `StockMovement.reversalOfId` (composite FK) | A implementar | `StockMovement` | Requer migration + composite FK |
| `runWithTenant` em todas as operações de stock | A corrigir | N/A | Ver C3, C4, C5 |
| Transacção em `issueCreditNote` | A corrigir | N/A | Ver C1, C2 |
| Proteção de rotas `/warehouses` e `/stock` | A corrigir | N/A | Ver M4, route-access.ts |

---

## 10. Plano de Implementação por Fases

### Fase 1 — Correções Críticas (pré-requisito)

**Objetivo:** Corrigir problemas críticos antes de qualquer código WMS v2.

**Ficheiros a modificar:**
1. `src/lib/invoice-service.ts`
   - Envolver `issueCreditNote` inteiro em `prisma.$transaction`
   - Passar `transaction` para `restoreStockForCancelledInvoice`
   - Mover leituras pré-transacção (tenant, customer, lastInvoice, invoiceCount) para dentro do tx
2. `src/lib/stock-service.ts`
   - Remover fallback `tx || prisma` em `decrementStockForInvoice` e `restoreStockForCancelledInvoice` — exigir `tx` obrigatório
   - Adicionar `runWithTenant` a `getLowStockAlerts`, `getStockValuationReport`, `getStockRotationReport`
3. `src/app/api/stock/warehouses/[id]/route.ts`
   - Envolver linhas 15 e 45 em `runWithTenant`
4. `src/app/api/stock/transfer/route.ts`
   - Tornar a verificação de stock e criação de movimentos atómica (usar `updateMany` com condição de stock suficiente)

**Testes necessários antes da Fase 1:**
- Teste de emissão de fatura com múltiplos itens (stock decrementado corretamente)
- Teste de anulação de fatura (stock restaurado, fatura marcada como ANULADA, nota de crédito criada — tudo atómico)
- Teste de concorrência: duas emissões simultâneas não devem gerar número de fatura duplicado
- Teste de transferência com stock insuficiente (não deve permitir overselling)

### Fase 2 — Migration do Schema

**Objetivo:** Aplicar `migration.v2.sql` corrigida (já validada em staging) e adaptar o schema Prisma.

**Ficheiros a modificar:**
1. `prisma/schema.prisma` — alinhar com `schema.v2.prisma` (adicionar campos, composite FKs, novos modelos)
2. Executar `migration.v2.sql` em produção (após backup completo)

**Testes necessários antes da Fase 2:**
- Backup completo da base de dados de produção
- `prisma validate` passa com 0 erros
- Executar migration em staging cópia da produção e verificar integridade
- Verificar que `Product.stock` (Int → Decimal) não perde dados

### Fase 3 — Backfill e Dados

**Objetivo:** Popular novos campos obrigatórios e tabelas novas.

**Ficheiros a modificar:**
- Scripts de backfill SQL (similares aos validados em staging)
- `src/lib/stock-service.ts` — adaptar para usar `ProductWarehouseStock` como fonte de stock

**Testes necessários antes da Fase 3:**
- Verificar que `BusinessDocumentCounter.id` foi populado sem duplicados
- Verificar que `StockMovement.quantitySigned` está consistente com `type` e `quantity`
- Verificar que `StockMovement.warehouseId` e `idempotencyKey` não têm NULLs
- Verificar que NOT NULL constraints podem ser aplicadas

### Fase 4 — Camada de Aplicação WMS

**Objetivo:** Implementar StockService, rotas de API, e páginas frontend.

**Ficheiros a criar/modificar:**
1. `src/lib/stock-service.ts` — reescrever para usar `ProductWarehouseStock`, lotes, reservas
2. Novas rotas de API: `/api/stock/lots`, `/api/stock/reservations`, `/api/stock/adjustments`, `/api/suppliers`, `/api/purchase-orders`, `/api/purchase-receptions`
3. `src/lib/route-access.ts` — adicionar `/warehouses` e `/stock` a `isProtectedPagePath`
4. Novas páginas frontend para WMS

**Testes necessários antes da Fase 4:**
- Testes de isolamento multi-tenant (ISO-01 a ISO-06 do STAGING_VALIDATION_PLAN)
- Testes de estorno cross-tenant bloqueado por composite FK
- Testes de CHECK constraints (8 constraints)
- Testes de concorrência em transferências e ajustes

### Fase 5 — Integração com Faturação

**Objetivo:** Alinhar faturação com o novo modelo de stock.

**Ficheiros a modificar:**
- `src/lib/invoice-service.ts` — usar `ProductWarehouseStock` em vez de `Product.stock` para baixa/restauração
- `src/lib/stock-service.ts` — funções de baixa/restauração devem atualizar `ProductWarehouseStock.quantity`

**Testes necessários antes da Fase 5:**
- Teste de emissão de fatura com produto em múltiplos armazéns (deve escolher armazém correto)
- Teste de anulação com restauração por armazém
- Teste de stock insuficiente em armazém específico

---

## 11. Testes Necessários Antes de Cada Fase

| Fase | Testes Obrigatórios |
|------|---------------------|
| 1 | Emissão atómica, anulação atómica, concorrência de numeração, sem overselling em transferência |
| 2 | `prisma validate` 0 erros, migration limpa em staging, integridade de dados pós-migration |
| 3 | Backfill sem duplicados, NOT NULL aplicável, CHECK constraints válidas |
| 4 | Isolamento ISO-01 a ISO-06, estorno cross-tenant bloqueado, 8 CHECK constraints, concorrência |
| 5 | Emissão com múltiplos armazéns, anulação com restauração por armazém, stock insuficiente |

---

## 12. Ficheiros que Deverão Ser Modificados em Cada Fase

### Fase 1
- `src/lib/invoice-service.ts` — `issueCreditNote` transação, leituras pré-tx, `restoreStockForCancelledInvoice` com `tx`
- `src/lib/stock-service.ts` — remover fallback global, `runWithTenant` em leituras
- `src/app/api/stock/warehouses/[id]/route.ts` — `runWithTenant` em leituras diretas
- `src/app/api/stock/transfer/route.ts` — atomicidade de stock

### Fase 2
- `prisma/schema.prisma` — alinhar com `schema.v2.prisma`
- `migration.v2.sql` (já corrigida) — aplicar em produção

### Fase 3
- Scripts SQL de backfill (não ficheiros do projeto, executados diretamente na BD)

### Fase 4
- `src/lib/stock-service.ts` — reescrita para `ProductWarehouseStock`
- Novas rotas de API WMS
- `src/lib/route-access.ts` — adicionar `/warehouses`, `/stock`
- Novas páginas frontend WMS

### Fase 5
- `src/lib/invoice-service.ts` — usar `ProductWarehouseStock`
- `src/lib/stock-service.ts` — atualizar `ProductWarehouseStock.quantity`

---

## 13. Parecer Técnico Final

**REPROVADO PARA IMPLEMENTAÇÃO DIRETA**

O código atual não está pronto para receber a implementação do WMS v2 sem correções prévias. Os problemas críticos (C1-C5) comprometem a integridade dos dados de stock e a segurança multi-tenant. Especificamente:

1. **`issueCreditNote` opera sem transacção** — risco de inconsistencia parcial entre nota de crédito, anulação de fatura e restauração de stock.
2. **`restoreStockForCancelledInvoice` é chamado sem `tx`** na anulação — sem contexto RLS, sem atomicidade.
3. **`decrementStockForInvoice` e `restoreStockForCancelledInvoice` aceitam chamada sem `tx`** — fallback para `prisma` global permite operações fora de transacção e sem RLS.
4. **Funções de leitura de stock usam `prisma` global sem `runWithTenant`** — vulnerável a leitura cross-tenant se RLS for activado.
5. **Várias rotas de API usam `prisma` global sem `runWithTenant`** (ex: `stock/warehouses/[id]`).

**Condição para aprovação:** Após conclusão da Fase 1 (correções críticas), o projeto estará apto para iniciar a implementação do WMS v2, começando pela Fase 2 (migration do schema).

**Não foram modificados ficheiros, não foram executadas migrations, não foi alterada a base de dados, não foi feito deploy, não foram criados commits nem pushes durante esta auditoria.**

---