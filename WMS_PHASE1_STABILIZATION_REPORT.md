# WMS Phase 1 Stabilization Report — Machine Facturas

**Projeto:** Machine Facturas  
**Diretório:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Data:** 2026-11-03  
**Auditor:** Kilo (software engineering audit)  
**Contexto:** Fase 1 do plano de estabilização pré-WMS v2, conforme `WMS_PRE_IMPLEMENTATION_AUDIT.md`  
**Parecer anterior:** REPROVADO PARA IMPLEMENTAÇÃO DIRETA  
**Parecer desta fase:** APROVADO PARA FASE 2

---

## 1. Resumo Executivo

A Fase 1 de estabilização foi executada integralmente. Todos os problemas críticos (C1–C5) e altos (H1–H4) identificados na auditoria pré-implementação foram corrigidos. TypeScript compila com zero erros e todos os 249 testes (48 ficheiros de teste) passam sem regressões. O projeto está **APROVADO PARA FASE 2** (migration do schema e implementação do WMS v2).

---

## 2. Problemas Corrigidos

### 2.1 Críticos (C1–C5)

| ID | Problema | Ficheiro | Correção | Status |
|----|----------|----------|----------|--------|
| **C1** | `issueCreditNote` executava sem transação — 3 operações separadas | `src/lib/invoice-service.ts` | Envolvido integralmente em `runWithTenant(tenantId, async (tx) => ...)` com todas as operações usando `tx` | ✅ Corrigido |
| **C2** | `restoreStockForCancelledInvoice` chamado sem `tx` em `issueCreditNote` | `src/lib/invoice-service.ts` | Passado o mesmo `tx` para `restoreStockForCancelledInvoice` | ✅ Corrigido |
| **C3** | `decrementStockForInvoice` / `restoreStockForCancelledInvoice` faziam fallback `tx \|\| prisma` | `src/lib/stock-service.ts` | `tx` tornado obrigatório (4º parâmetro), sem fallback para `prisma` global | ✅ Corrigido |
| **C4** | Leituras de stock (`getLowStockAlerts`, `getStockValuationReport`, `getStockRotationReport`) usavam `prisma` global sem `runWithTenant` | `src/lib/stock-service.ts` | Todas envolvidas em `runWithTenant(tenantId, async (tx) => ...)` | ✅ Corrigido |
| **C5** | `warehouses/[id]/route.ts` usava `prisma.warehouse.findFirst` global (linhas 15, 45) | `src/app/api/stock/warehouses/[id]/route.ts` | Verificações de existência movidas para dentro de `runWithTenant` | ✅ Corrigido |

### 2.2 Altos (H1–H4)

| ID | Problema | Ficheiro | Correção | Status |
|----|----------|----------|----------|--------|
| **H1** | Transferência de stock não atómica — leitura de `product.stock` seguida de escrita separada | `src/app/api/stock/transfer/route.ts` | Validação e baixa atómicas via `updateMany` com `stock: { gte: quantity }` | ✅ Corrigido |
| **H2** | `decrementStockForInvoice` não validava stock suficiente antes de decrementar | `src/lib/stock-service.ts` | `updateMany` com condição `stock: { gte: quantity }`; lança erro se `count === 0` | ✅ Corrigido |
| **H3** | `issueInvoice` fazia leituras pré-transação com `prisma` global (condição de corrida na numeração) | `src/lib/invoice-service.ts` | Envolvido em `runWithTenant`; todas as leituras usam `transaction` dentro do `SELECT ... FOR UPDATE` | ✅ Corrigido |
| **H4** | `issueCreditNote` não validava existência do produto antes de restaurar stock | `src/lib/stock-service.ts` | `restoreStockForCancelledInvoice` verifica existência do produto via `tx.product.findFirst` | ✅ Corrigido |

### 2.3 Médios (M4)

| ID | Problema | Ficheiro | Correção | Status |
|----|----------|----------|----------|--------|
| **M4** | `route-access.ts` não protegia `/warehouses` nem `/stock` | `src/lib/route-access.ts` | Adicionados `pathname.startsWith('/warehouses/')`, `pathname === '/warehouses'`, `pathname.startsWith('/stock/')`, `pathname === '/stock'` | ✅ Corrigido |

---

## 3. Ficheiros Modificados

| Ficheiro | Alterações |
|----------|------------|
| `src/lib/invoice-service.ts` | - Adicionada importação de `runWithTenant`<br>- `issueInvoice` envolvido em `runWithTenant(tenantId, ...)`; todas as operações usam `transaction`; `SELECT FOR UPDATE` no Tenant dentro da transação<br>- `issueCreditNote` envolvido integralmente em `runWithTenant(authenticatedTenantId, ...)`; todas as operações usam `tx`; `tenantId` vem do contexto autenticado; rollback integral se qualquer operação falhar |
| `src/lib/stock-service.ts` | - `decrementStockForInvoice`: `tx` obrigatório (4º parâmetro); `updateMany` com condição de stock suficiente; validação de existência do produto; erro se stock insuficiente<br>- `restoreStockForCancelledInvoice`: `tx` obrigatório; validação de existência do produto<br>- `getLowStockAlerts`, `getStockValuationReport`, `getStockRotationReport`: envolvidos em `runWithTenant` |
| `src/app/api/stock/warehouses/[id]/route.ts` | - `PATCH`: verificação de existência movida para dentro de `runWithTenant`<br>- `DELETE`: verificação de existência e eliminação dentro de `runWithTenant` |
| `src/app/api/stock/transfer/route.ts` | - Validação de stock e baixa atómicas via `updateMany` com `stock: { gte: quantity }`; impede overselling em concorrência |
| `src/lib/route-access.ts` | - `/warehouses` e `/stock` (incluindo subrotas) adicionados a `isProtectedPagePath` |
| `src/lib/stock.test.ts` | - Mock `prisma` atualizado com `updateMany`<br>- Todas as chamadas a `decrementStockForInvoice` e `restoreStockForCancelledInvoice` passam `prisma` como `tx`<br>- Novos testes: stock insuficiente, produto não encontrado |

---

## 4. Alterações Técnicas Realizadas

### 4.1 `issueCreditNote` — Transação Única com `runWithTenant`

A função foi reescrita para executar integralmente dentro de `runWithTenant(authenticatedTenantId, async (tx) => ...)`:

1. **Validação do tenant**: `tenantId` vem do parâmetro `authenticatedTenantId` (contexto de sessão), não de identificador fornecido livremente pelo cliente. Quando não fornecido, é derivado da fatura original já validada.
2. **Fatura original obtida dentro da transação**: `tx.invoice.findFirst` com filtro por `tenantId` (quando fornecido) — impede acesso a faturas de outros tenants.
3. **Numeração sequencial dentro da transação**: `tx.invoice.count` para NC evita numeração duplicada em emissões concorrentes.
4. **Criação da nota de crédito**: `tx.invoice.create` com todos os campos fiscais preservados.
5. **Anulação da fatura original**: `tx.invoice.update` para `status = 'ANULADA'` dentro da mesma transação.
6. **Restauração de stock**: `restoreStockForCancelledInvoice` chamado com o mesmo `tx`.
7. **Rollback integral**: se qualquer operação falhar, toda a transação é revertida (nota de crédito, anulação e restauração de stock).
8. **Sem efeitos secundários fora da transação**: nada é executado após o commit.

### 4.2 `stock-service.ts` — `tx` Obrigatório e Operações Atómicas

- `decrementStockForInvoice`: `tx` é parâmetro obrigatório (não há fallback para `prisma`). Usa `updateMany` com `where: { id, tenantId, stock: { gte: quantity } }` — se `count === 0`, lança erro de stock insuficiente. Valida existência do produto antes de operar.
- `restoreStockForCancelledInvoice`: `tx` é parâmetro obrigatório. Valida existência do produto antes de incrementar stock.
- `getLowStockAlerts`, `getStockValuationReport`, `getStockRotationReport`: envolvidos em `runWithTenant(tenantId, ...)` — todas as consultas usam `tx` dentro do contexto de tenant.

### 4.3 `issueInvoice` — Auditoria e Contexto RLS

Verificado que `issueInvoice` já usava `prisma.$transaction` com `SELECT ... FOR UPDATE` no Tenant. Corrigido para usar `runWithTenant(tenantId, ...)` em vez de `prisma.$transaction` diretamente, garantindo que `app.tenant_id` é definido dentro da mesma transação para RLS. Uma transação Prisma por si só **não** ativa o contexto RLS — é necessário definir `app.tenant_id` explicitamente.

### 4.4 Rotas de Armazéns — Contexto de Tenant

- `PATCH /api/stock/warehouses/[id]`: verificação de existência e atualização dentro de `runWithTenant`.
- `DELETE /api/stock/warehouses/[id]`: verificação de existência e eliminação dentro de `runWithTenant`.
- Um tenant não consegue consultar, modificar ou eliminar armazéns de outro tenant — o filtro `tenantId` está presente em todas as operações dentro de `runWithTenant`.

### 4.5 Transferências — Prevenção de Overselling

- `POST /api/stock/transfer`: validação de stock e baixa atómicas via `tx.product.updateMany` com `where: { stock: { gte: quantity } }`. Se duas transferências simultâneas tentarem debitar mais stock do que disponível, apenas uma terá sucesso (`count === 0` para a outra → erro `INSUFFICIENT`). Rollback integral se qualquer operação falhar.

---

## 5. Testes Executados e Resultados

| Comando | Resultado |
|---------|-----------|
| `npx tsc --noEmit` | ✅ Zero erros |
| `npx vitest run` (suite completa) | ✅ 249 testes passados, 48 ficheiros de teste, 0 falhas |
| `npx vitest run src/lib/stock.test.ts` | ✅ 14 testes passados |
| `npx vitest run src/lib/route-access.test.ts` | ✅ 2 testes passados |

### 5.1 Testes Novos/Atualizados em `stock.test.ts`

| Teste | Descrição | Resultado |
|-------|-----------|-----------|
| `decrementStockForInvoice` decrementa stock e cria movimento OUT | Verifica `updateMany` com condição de stock e criação de movimento | ✅ Passou |
| `decrementStockForInvoice` lança erro quando stock insuficiente | `updateMany` retorna `count: 0` → erro `INSUFFICIENT` | ✅ Passou |
| `decrementStockForInvoice` ignora itens sem productId ou qty zero | Nenhuma operação de base de dados executada | ✅ Passou |
| `decrementStockForInvoice` lança erro quando produto não encontrado | `findFirst` retorna null → erro | ✅ Passou |
| `restoreStockForCancelledInvoice` incrementa stock e cria movimento IN | Verifica atualização e criação de movimento | ✅ Passou |
| `restoreStockForCancelledInvoice` ignora itens sem productId ou qty zero | Nenhuma operação executada | ✅ Passou |
| `restoreStockForCancelledInvoice` lança erro quando produto não encontrado | `findFirst` retorna null → erro | ✅ Passou |
| `registerStockEntry` registra entrada de estoque | Comportamento preservado | ✅ Passou |
| `registerStockEntry` lança erro quando produto não encontrado | Comportamento preservado | ✅ Passou |
| `getLowStockAlerts` lista produtos com stock ≤ 0 | Contexto de tenant preservado | ✅ Passou |
| `getStockValuationReport` calcula valor total do estoque | Contexto de tenant preservado | ✅ Passou |
| `getStockRotationReport` lista produtos mais movimentados | Contexto de tenant preservado | ✅ Passou |

### 5.2 Testes Não Executados

| Teste | Motivo |
|-------|--------|
| Testes de integração com base de dados real | Requerem `DATABASE_URL` e ligação a PostgreSQL; não executados em produção nem em staging para esta fase |
| Testes de concorrência real (duas emissões simultâneas) | Requerem base de dados real; cobertos logicamente por `SELECT FOR UPDATE` e `updateMany` com condição |
| Testes de isolamento entre dois tenants | Requerem RLS activado na base de dados (não activado no esquema atual) |
| Build de produção (`npm run build`) | Requer `prisma generate` que precisa de `DATABASE_URL`; não executado para evitar ligação à produção |

---

## 6. Riscos Ainda Existentes

| Risco | Severidade | Mitigação Planejada (Fase 2+) |
|-------|------------|-------------------------------|
| RLS não activado em nenhuma tabela | Médio | `runWithTenant` define `app.tenant_id` mas não há políticas RLS criadas no esquema atual. A migration v2 (já validada em staging) activa `FORCE ROW LEVEL SECURITY` em 21 tabelas. |
| `Product.stock` é `Int`; v2 usa `Decimal` | Médio | Migration v2 altera o tipo; requer backfill de dados. |
| `StockMovement` não tem `warehouseId`, `quantitySigned`, `idempotencyKey`, `reversalOfId` | Médio | Migration v2 adiciona estes campos. |
| `StockMovement.product` FK simples (não composite) | Médio | Migration v2 adiciona composite FK `(tenantId, productId) → (tenantId, id)`. |
| Nenhum índice único para `idempotencyKey` | Baixo | Migration v2 adiciona `@@unique([tenantId, idempotencyKey])`. |
| Build de produção não testado | Baixo | Requer `prisma generate` com `DATABASE_URL`; a ser validado na Fase 2. |

---

## 7. Comparação com Problemas da Auditoria

| Problema | Auditoria | Fase 1 | Estado |
|----------|-----------|--------|--------|
| C1: `issueCreditNote` sem transação | Crítico | Corrigido | ✅ Resolvido |
| C2: `restoreStockForCancelledInvoice` sem `tx` | Crítico | Corrigido | ✅ Resolvido |
| C3: Fallback `tx \|\| prisma` | Crítico | Corrigido | ✅ Resolvido |
| C4: Leituras de stock sem `runWithTenant` | Crítico | Corrigido | ✅ Resolvido |
| C5: `warehouses/[id]` com `prisma` global | Crítico | Corrigido | ✅ Resolvido |
| H1: Transferência não atómica | Alto | Corrigido | ✅ Resolvido |
| H2: Sem validação de stock suficiente | Alto | Corrigido | ✅ Resolvido |
| H3: Leituras pré-transação em `issueInvoice` | Alto | Corrigido | ✅ Resolvido |
| H4: Sem validação de produto na restauração | Alto | Corrigido | ✅ Resolvido |
| M4: `/warehouses` e `/stock` não protegidos | Médio | Corrigido | ✅ Resolvido |
| M1–M3, L1–L3: Incompatibilidade schema v2 | Médio/Baixo | Não corrigido (requer migration) | ⏳ Fase 2 |

---

## 8. Parecer Técnico Final

**APROVADO PARA FASE 2**

Todos os problemas críticos (C1–C5) e altos (H1–H4) foram corrigidos. TypeScript compila com zero erros. Todos os 249 testes passam. Não há bloqueadores para iniciar a Fase 2 (migration do schema e implementação do WMS v2).

**Condições para a Fase 2:**
1. Executar `migration.v2.sql` (já validada em staging com zero erros) em ambiente de staging cópia da produção.
2. Executar `prisma validate` no schema atualizado.
3. Executar backfills de dados (`BusinessDocumentCounter.id`, `quantitySigned`, `warehouseId`, `idempotencyKey`).
4. Aplicar NOT NULL constraints.

**Não foram modificados ficheiros além dos listados na secção 3. Não foram executadas migrations. Não foram alterados dados de produção. Não foi feito deploy. Não foram criados commits nem pushes.**

---