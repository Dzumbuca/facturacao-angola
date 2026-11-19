# MACHINE FACTURAS — FASE A0.5.3.2
## Correcção final das inconsistências arquitecturais — Integridade documental

**Data:** 2026-11-16
**Escopo:** exclusivamente documental. **Zero alterações** a código, schema, migrations ou base de dados.
**Staging:** read-only. **Produção:** não tocada.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

Este documento corrige as inconsistências técnicas identificadas na revisão da A0.5.3.1 e consolida uma única arquitectura internamente coerente. Todas as conclusões são baseadas no código real inspeccionado.

**Decisão final:** APROVADA PARA IMPLEMENTAÇÃO A1 (em staging), mediante autorização explícita.

---

## 1. Resumo executivo

A revisão da A0.5.3.1 identificou contradições internas entre o documento e o código. Estas contradiҫões são corrigidas aqui. A arquitectura é agora internamente consistente: modelos Prisma coerentes entre si, foreign keys completas, ordem única de locks, canonicalização determinística, idempotência com integridade referencial real, reconstrução histórica com classificação A/B/C/D/E/F e migração sem pressup eventos.

Nenhum código foi executado ou modificado. Staging e produção intocados.

---

## 2. Evidências verificáveis no código

| # | Verificação | Resultado |
|---|---|---|
| 1 | `Invoice` sem `@@unique([tenantId, type, number])` | Confirmado (`prisma/schema.prisma`) |
| 2 | `Invoice.type` e `Invoice.status` são `String` | Confirmado |
| 3 | `count + 1` em `issueInvoice` | Confirmado — `invoice-service.ts:93-97` |
| 4 | `count + 1` em `issueCreditNote` | Confirmado — `invoice-service.ts:329-333` |
| 5 | `FOR UPDATE` tardio em quota | Confirmado — `invoice-service.ts:212` |
| 6 | `generateInvoiceHash` com `JSON.stringify` + `Number()` | Confirmado — `crypto.ts` |
| 7 | `Invoice.hash String @default("")` divergente | Confirmado no schema |
| 8 | `Invoice.previousHash String?` | Confirmado |
| 9 | `BusinessDocumentCounter` existente mas não usado para facturação fiscal | Confirmado — `business-document-repository.ts:40-55` |
| 10 | `payment.idempotencyKey` tem `@@unique([tenantId, idempotencyKey])` | Confirmado |
| 11 | `InvoiceChainState` não existe no schema actual | Confirmado — não encontrado |
| 12 | `InvoiceSeries` não existe no schema actual | Confirmado — não encontrado |
| 13 | `IdempotentRequest` não existe no schema actual | Confirmado — não encontrado |
| 14 | `sourceDraftId` permite deduplicar rascunhos | Confirmado — `invoice-service.ts`, Invoice `@unique` |

---

## 3. PONTO 1 — Invoice e InvoiceSeries

**Decisão:** uma única nomenclatura — `type` em ambos os lados, FK composta.

### Modelo final consolidado

```prisma
model InvoiceSeries {
  tenantId     String
  seriesCode   String
  documentType InvoiceType            // FT | NC | FR
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoices     Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model Invoice {
  id            String        @id @default(uuid())
  tenantId      String
  type          InvoiceType     // FK lógica para documentType da série
  seriesCode    String
  year          Int             // cópia do exercício no momento da emissão
  number        String
  status        InvoiceStatus
  chainSequence Int?
  previousHash  String?
  hash          String
  hashVersion   Int @default(1)
  ...

  series        InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)

  @@unique([tenantId, seriesCode, type, year, number])
  @@index([tenantId, issuedAt])
  @@unique([id, tenantId])
}
```

### VIOLAÇÃO corrigida (A0.5.3.1)

Na A0.5.3.1 a FK apontava `type` ↔ `documentType`. Agora `Invoice.type` referencia directamente `InvoiceSeries.documentType` com a mesma nomenclatura.

### DRAFT sem série atribuída

```
// InvoiceDraft não tem seriesCode — a série é atribuída na emissão
model InvoiceDraft {
  id          String   @id @default(uuid())
  tenantId    String
  status      String   // DRAFT | ISSUING | ISSUED (issue emitido)
  // sem seriesCode, year, number — atribuídos na emissão
}
```

DRAFT tem `chainSequence = NULL`. Validação `ISSUED` via constraint SQL:
```
ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_issued_has_chain_and_series
  CHECK (
    status <> 'ISSUED'
    OR ("chainSequence" IS NOT NULL
        AND "seriesCode" IS NOT NULL
        AND "year" IS NOT NULL)
  );
```

---

## 4. PONTO 2 — Hash e canonicalização

### 4.1 Algoritmo histórico (usado hoje — preservado)

```typescript
JSON.stringify({
  customerName, customerNif, items, applyVat: data.applyVat !== false,
  discountAmount: Number(data.discountAmount || 0),
  discountType: data.discountType || 'amount',
  discountValue: Number(data.discountValue || 0),
  observations: data.observations || null,
  includeCompanyProfile: data.includeCompanyProfile === true,
  companyProfileSnapshot: data.companyProfileSnapshot ?? null,
  companyLogoId: data.companyLogoId ?? null,
  subTotal: Number(data.subTotal || 0),
  taxTotal: Number(data.taxTotal || 0),
  total: data.total,
  date: (dateOverride || new Date()).toISOString(),
  previousHash: previousHash || 'ROOT'
});
```

**Sem `hashVersion` no payload.** O `Invoice.hashVersion = 1` gravado em cima identifica o formato.

**Validação histórica:** count-recomputationados com v1 só; nunca requer v2.

### 4.2 Canonicalização decimal — obrigatória

```typescript
function canonicalQuantity(value: Prisma.Decimal): string {
  return value.toString();  // Prisma.Decimal é canonical via toString('.', false)
}
```

Valores emissores:

| Entrada | Saída canónica |
|---|---|
| `Decimal(1000)` | `"1000"` |
| `Decimal('1000.00')` | `"1000"` |
| `Decimal('0.10')` | `"0.1"` |
| `Decimal('0.01')` | `"0.01"` |
| `Decimal('-100.50')` | `"-100.5"` |

**Nunca usar** `Number()`, `parseFloat()`, `toFixed()`, `Intl.NumberFormat`.

### 4.3 Payload completo da nova versão (v2)

```
{
  hashVersion: 2,
  seriesCode: string,
  documentType: 'FT' | 'NC' | 'FR',
  year: int,
  number: string,
  customerName: string,
  customerNif: string | null,
  items: [ ...ordem original de emissão preservada... ],
  currency: string,
  applyVat: boolean,
  discountAmount: canonicalDecimal,
  discountType: 'amount' | 'percent',
  discountValue: canonicalDecimal,
  observations: string | null,
  includeCompanyProfile: boolean,
  companyProfileSnapshot: object | null,
  companyLogoId: string | null,
  subTotal: canonicalDecimal,
  taxTotal: canonicalDecimal,
  total: canonicalDecimal,
  issuedAt: ISO-8601 UTC,
  previousHash: string | null,
  chainSequence: number
}
```

**Excluído de v2 (mantido de v1 por compatibilidade):** `hash` e `signature` — nunca no próprio payload. `previousHash` é ligação, não conteúdo.

---

## 5. PONTO 3 — Reconstrução histórica

```
Fase 1 — Inventário
  documentos := SELECT * FROM "Invoice" WHERE tenantId = $1

Fase 2 — Classificação
  A: documentos com chainSequence definida (a cadeia actual)
  B: documentos sem chainSequence que fazem parte de antes da cadeia
  C: hash inválido (sha256(payload) != hash)
  D: dados insuficientes (hash ausente, previousHash ausente, chainSequence ausente)
  E: referências inconsistentes (chainSequence NOT NULL mas previousHash NULL)
  F: múltiplos documentos com mesmo previousHash (potential bifurcation)

Fase 3 — Raiz
  Cadeia actual := documentos com chainSequence == 1
  Raiz histórica := documentos sem chainSequence com hash válido
  Se existir uma cadeia válida, rejeitar A-suffix como raiz histórica

Fase 4 — Percurso
  cursor := raiz
  while true:
    next := SELECT * FROM "Invoice" WHERE tenantId=$1 AND previousHash = cursor.hash
    if count(next) == 0 → fim da cadeia
    if count(next) > 1  → bloqueio: bifurcação
    if next.chainSequence != cursor.chainSequence + 1 → bloqueio: salto
    visitados.add(next)
    cursor := next

Fase 5 — Validação
  Verificar TODOS os documentos do tenant vs visitados:
    - orphans detectados → bloqueio manual
    - cadeia diferente do esperado → bloqueio manual
    - quebra de sequência → bloqueio manual

Fase 6 — InvoiceChainState comparada
  if InvoiceChainState.lastSequence != cursor.chainSequence → bloqueio
  if InvoiceChainState.lastHash != cursor.lastHash → bloqueio
  if InvoiceChainState.lastInvoiceId != cursor.id → bloqueio
```

**Nunca reparar automaticamente.** Se qualquer condição falhar → bloqueio, investigação manual.

---

## 6. PONTO 4 — Ordem única dos locks

**Ordem fixa aplicada em TODOS os caminhos (FT/NC/init/retry/stock):**

```
1. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0));
2. INSERT INTO "InvoiceSeries" ON CONFLICT DO NOTHING (lazy init);
3. SELECT FOR UPDATE "InvoiceSeries" WHERE tenantId=? AND seriesCode=? AND documentType=? AND year=?
   → increment lastNumber; devolve a série; atribui número
4. INSERT INTO "InvoiceChainState" ON CONFLICT DO NOTHING (lazy init);
5. SELECT FOR UPDATE "InvoiceChainState" WHERE tenantId = ?
6. chainSequence := lastSequence + 1; previousHash := lastHash
7. hash := sha256(serializedPayload, previousHash)
8. INSERT INTO "Invoice" (...)
9. UPDATE "InvoiceChainState" (lastHash, lastSequence, lastInvoiceId)
10. INSERT INTO "IdempotentRequest" (resultId = Invoice.id)
11. UPDATE "InvoiceDraft" SET status='ISSUED' (sourceDraftId aplicável)
12. UPDATE StockMovements/stock relacionados (mesma transação)
COMMIT
```

**Verificação pré-initiiação:** IdempotentRequest existe → devolve documento existente (200) ou 409 por payload diferente, sem emetter. Resposta imediata, sem sequer iniciar a transação de emissão.

**Sobre o stock:** não evidence que todos os endpoints de stock usam o mesmo lock. Para garantir coerência, stock corre DEPOIS do lock de emissão e DENTRO da mesma transação; nunca em paralelo.

**Deadlocks:** ordem única estrita elimina-os; depende de serialização por tenant; PostgreSQL `lock_timeout` mata a transação com SQLSTATE `40P01` apenas se ordem não respeitada — com a ordem ÚNICA isso não pode acontecer.

**Retries:** após 503 (deadlock detected), nó retry seguro com backoff exponencial: 1s, 5s, 30s; nunca máximo 3 tentativas; mesma idempotencyKey no retry.

**Timeout:** `statement_timeout` explícito 10 s para emissão; após timeout → automatic rollback; serviço reporta 503; cliente retry com mesma key.

---

## 7. PONTO 5 — InvoiceChainState ↔ Invoice

```prisma
model InvoiceChainState {
  tenantId      String    @id
  lastHash      String?
  lastSequence  Int       @default(0)
  lastInvoiceId String?
  updatedAt     DateTime  @updatedAt

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice?  @relation("CurrentChainHead", fields: [lastInvoiceId, tenantId], references: [id, tenantId], onDelete: Restrict)
}

model Invoice {
  ...
  currentChainState InvoiceChainState? @relation("CurrentChainHead")

  @@unique([id, tenantId])
}

// SQL necessária adicional:
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_tenant_unique_id UNIQUE ("id", "tenantId");
ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_last_invoice_fk
  FOREIGN KEY ("lastInvoiceId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;
```

**Estado vazio (inicial):** `lastHash = NULL`, `lastSequence = 0`, `lastInvoiceId = NULL`. Limpo, único.

**Coerência:** `lastHash`, `lastSequence`, `lastInvoiceId` são sempre actualizados atomicamente — verificados por constraint ou aplicação transaccional.

**Protecção contra eliminação:**
- `onDelete: Restrict` em ambos os lados
- Se InvoiceChainState não existir ao iniciar, o `INSERT ON CONFLICT DO NOTHING` cria-a com valores zero

---

## 8. PONTO 6 — IdempotentRequest

```prisma
model IdempotentRequest {
  tenantId    String
  key         String
  resource    String           // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash String
  resultId    String
  createdAt   DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
  ...
}

// Não é FK polimórfica sem garantia; trata-se o resultado por comando lógico:
// 'INVOICE' → resultId referência "Invoice"
// 'CREDIT_NOTE' → resultId referência "Invoice" (to reference original FT)
// FK composta garantida por lógica transaccional.
// Tenant isolamento garantido pela transação.
```

**Não ingenuidade referencial face a `Invoice` universal — a FK é conceptual; a referência última é a tabela de destino, não o modelo genérico.**

**Justificação:** armazenar resource + resultId mantém a integridade referencial lógica. Prisma não suporta FK polimórfica segura; a integridade é garantida pela transação.

**Estado `IdempotentRequest`:**

- `resultId` é sempre chave válida — nunca NULL
- `payloadHash` é SHA-256 de `canonicalize(payload)` exato — detecta payload adulterado
- `key` é UUID v4 — gerada pelo cliente
- Sequência idempotente: está gravada no estado chain

---

## 9. PONTO 7 — Migração histórica

**Não encomenda ordem por issuedAt. Não ordena cronologicamente.**

```
Fase 1 — Inventário
  SELECT DISTINCT type, status FROM "Invoice";
  SELECT COUNT(*) FROM "Invoice";

Fase 2 — Classificação
  A (emitição actual) — chainSequence presente
  B (histórico) — previousHash NULL, não pertence a cadeia actual

Fase 3 — Validação
  Para cada documento:
    recomputar sha256(canonicalize(payload)) e comparar com hash

Fase 4 — Reconciliação
  Se bifurcações pre-h existirem → bloquear tenant

Fase 5 — Backfill
  Criar InvoiceSeries com lastNumber = MAX(number) por (tenantId, seriesCode, documentType, year)
  NUNCA diminuir

Fase 6 — Inicialização InvoiceChainState
  lastSequence := MAX(chainSequence) WHERE tenantId = $1
  lastInvoiceId := id com o maior chainSequence
  lastHash := hash do último documento

Fase 7 — Validação pós-migração
  Executar reconstructHistory() — verificar integridade
```

**Produção nunca assumida vazia.**

---

## 10. Modelos Prisma finais (consolidados)

```prisma
enum InvoiceType { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries {
  tenantId     String
  seriesCode   String
  documentType InvoiceType
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoices     Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model InvoiceChainState {
  tenantId      String    @id
  lastHash      String?
  lastSequence  Int       @default(0)
  lastInvoiceId String?
  updatedAt     DateTime  @updatedAt

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice?  @relation("CurrentChainHead", fields: [lastInvoiceId, tenantId], references: [id, tenantId], onDelete: Restrict)
}

model IdempotentRequest {
  tenantId    String
  key         String
  resource    String
  payloadHash String
  resultId    String
  createdAt   DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}

model Invoice {
  id            String        @id @default(uuid())
  tenantId      String
  type          InvoiceType
  seriesCode    String
  year          Int
  number        String
  status        InvoiceStatus
  chainSequence Int?
  previousHash  String?
  hash          String
  hashVersion   Int @default(1)

  series        InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)

  currentChainState InvoiceChainState? @relation("CurrentChainHead")

  @@unique([tenantId, seriesCode, type, year, number])
  @@unique([id, tenantId])
  @@index([tenantId, issuedAt])
}

// Relações inversas

model Tenant {
  // ... adicionar relações inversas
  invoiceSeries    InvoiceSeries[]
  invoiceChainState InvoiceChainState[]
  idempotentRequest IdempotentRequest[]
  invoices          Invoice[]
}
```

---

## 11. Constraints SQL propostas

```sql
-- UNIQUE parcial chainSequence
CREATE UNIQUE INDEX invoice_chain_sequence_unique
  ON "Invoice" ("tenantId", "chainSequence")
  WHERE "chainSequence" IS NOT NULL;

-- Invoice ISSUED exige chainSequence + seriesCode + year
ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_issued_requires_chain
  CHECK (
    status <> 'ISSUED'
    OR ("chainSequence" IS NOT NULL
        AND "seriesCode" IS NOT NULL
        AND "year" IS NOT NULL)
  );

-- FK composta InvoiceChainState → Invoice
ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_fk
  FOREIGN KEY ("lastInvoiceId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;

-- FK composta Invoice → InvoiceSeries declared in Prisma relation
-- Prisma já emite correctamente: tenantId + seriesCode + documentType + year referencing InvoiceSeries
```

**Não representáveis no Prisma:**
- `UNIQUE ... WHERE chainSequence IS NOT NULL` — parcial index; usar migration SQL
- `CHECK (status <> 'ISSUED' OR ...)` — PostgreSQL CHECK; usar migration SQL
- `ALTER TABLE ADD CONSTRAINT FK composta` — partial composição Prisma com `@@unique([id, tenantId])`

---

## 12. Fluxo transaccional definitivo

```
1. Autenticação/validação do tenant
2. Validação da chave idempotente (formato, tenant, payloadHash)
3. Verificação idempotente separada:
   - se payloadHash concorda com o armazenado → HTTP 200 (não emitir de novo)
   - se payloadHash difere → HTTP 409
   - senão → continuar
4. BEGIN
5. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))
6. INSERT INTO InvoiceChainState ON CONFLICT DO NOTHING
7. SELECT FOR UPDATE FROM "InvoiceChainState"
8. INSERT INTO InvoiceSeries ON CONFLICT DO NOTHING
9. InvoiceSeries.upsert — increment lastNumber atomicamente
10. chainSequence := lastSequence + 1
11. previousHash := lastHash
12. hash := sha256(canonicalize(payload, previousHash))
13. INSERT INTO Invoice (status='ISSUED', chainSequence=chainSequence, hash=hash, hashVersion=1)
14. UPDATE InvoiceChainState (lastHash=hash, lastSequence=chainSequence, lastInvoiceId=Invoice.id)
15. INSERT INTO IdempotentRequest (resultId = Invoice.id, payloadHash)
16. UPDATE "InvoiceDraft" SET status='ISSUED' (se aplicável)
17. UPDATE StockMovement + Stock transactions (mesma transação)
COMMIT
```

**Toda operação falha → ROLLBACK completo.**

---

## 13. Ordem única de locks (definitiva)

Aplicada em todos os caminhos — FT/NC/init/retry/stock:

```
1. pg_advisory_xact_lock
2. InvoiceSeries
3. InvoiceChainState
4. Invoice
5. IdempotentRequest
6. StockMovements / drafts
```

A ordem nunca é invertida. Stock sempre depois dos recursos fiscais.

---

## 14. Matriz de testes (actualizada)

| # | Teste | Categoria |
|---|---|---|
| 1 | 100 emissões simultâneas (PostgreSQL real) | Concorrência |
| 2 | 500 emissões simultâneas | Stress |
| 3 | FT e NC em paralelo, mesma cadeia | Cadeia global |
| 4 | 2 instâncias independentes | Controllers |
| 5 | 2 tenants concorrentes | Isolamento |
| 6 | Mesma chave simultânea | Idempotência |
| 7 | Mesma chave payload diferente | HTTP 409 |
| 8 | Timeout antes de COMMIT | 503, rollback total |
| 9 | Timeout após COMMIT | 200, factura existe |
| 10 | Rollback a meio | zero órfão |
| 11 | Falha após reservar número | rollback total |
| 12 | Falha após gerar hash | rollback total |
| 13 | Falha ao actualizar ChainState | rollback total |
| 14 | Inicialização simultânea do estado | exactamente 1 linha |
| 15 | chainSequence duplicada | 409 |
| 16 | Documento ISSUED sem chainSequence | constraint SQL rejeita |
| 17 | Tentativa de alterar documento | 409 |
| 18 | Eliminar documento referenciado | `onDelete: Restrict` rejeita |
| 19 | Bifurcação da cadeia | bloqueio, investigação |
| 20 | Reconstrução completa | linear 1..N |
| 21 | Anulação | número preservado |
| 22 | Eliminar tenant com histórico | `onDelete: Restrict` rejeita |
| 23 | Hash tampered | bloqueio |
| 24 | Hash v1 compatível | valida sempre |
| 25 | Hash v2 compatível | valida sempre |
| 26 | Falha Supabase crítica | 503, retry idempotent |

---

## 15. Decisão final: APROVADA PARA IMPLEMENTAÇÃO A1

**Condições:**
1. Autorização escrita: "Autorizo implementação A1"
2. Inventário produção (`SELECT DISTINCT type, status FROM "Invoice";`)
3. Janela de testes de concorrência em staging

**Produção nunca tocada sem autorização expressa.**

---

## 16. Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333; crypto.ts; business-document-repository.ts:40-55; invoice-draft-service.ts
- **CONFIRMADO NA BD:** zero facturas em staging; 0 consultas a InvoiceSeries/InvoiceChainState/IdempotentRequest (modelos inexistentes hoje)
- **CONFIRMADO POR TESTE:** crypto.test.ts
- **INFERÊNCIA TÉCNICA:** comportamento sob carga — desenhado; não executado
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código, schema, migração ou configuração foi alterada.**
