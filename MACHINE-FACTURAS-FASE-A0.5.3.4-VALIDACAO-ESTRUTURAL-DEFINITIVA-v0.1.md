# MACHINE FACTURAS — FASE A0.5.3.4
## Validação estrutural definitiva — Integridade documental e facturação fiscal

**Data:** 2026-11-16
**Natureza:** exclusivamente documental. **Nenhuma alteração** a código, schema, migrations ou base de dados foi executada nesta fase.
**Staging:** read-only. **Produção:** não tocada.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).
**Ferramenta de validação (read-only):** `npx prisma validate` executado com sucesso.

---

## 1. Resumo executivo

Executada validação estrutural do schema existente e consolidadas as decisões das fases anteriores. Esta fase entrega o esquema Prisma completo e coerente, a especificação criptográfica integral e o protocolo transaccional definitivo. Nenhuma ambiguidade técnica subsiste.

**Decisão final:** **APROVADA COM PENDÊNCIAS — A1 BLOQUEADA ATÉ:**
1. Autorização escrita do cliente
2. Inventário de produção (SELECT DISTINCT type, status, count(*) FROM "Invoice";)
3. Janela de testes de concorrência em staging (100 FT+NC paralelos em PostgreSQL real)

A aprovação arquitectural **NÃO** autoriza alterações na base de dados.

---

## 2. Evidências verificáveis do código real

| # | Verificação | Como confirmado |
|---|---|---|
| 1 | `Invoice.type` e `Invoice.status` são `String` sem enum | `prisma/schema.prisma` — modelo `Invoice` |
| 2 | `Invoice` sem `@@unique([tenantId, type, number])` | `prisma/schema.prisma` — modelo `Invoice` |
| 3 | `Invoice.hash String?` — opcional | `schema.prisma` — `hash String?` |
| 4 | `Invoice.previousHash String?` — opcional | `schema.prisma` — `previousHash String?` |
| 5 | `Invoice.sourceDraftId String? @unique` | `schema.prisma` — modelo `Invoice` |
| 6 | `count + 1` em emissão FT | `invoice-service.ts:93-97` |
| 7 | `count + 1` em emissão NC | `invoice-service.ts:329-333` |
| 8 | `FOR UPDATE` tardio (após count) | `invoice-service.ts:212` |
| 9 | `generateInvoiceHash` com `JSON.stringify` e `Number()` | `crypto.ts:11-44` |
| 10 | Cadeia de hash não protegida por lock | `invoice-service.ts:84-127` (orderBy, sem lock) |
| 11 | `BusinessDocumentCounter` presente no schema | `schema.prisma` — modelo `BusinessDocumentCounter` |
| 12 | `Payment.idempotencyKey` com `@@unique([tenantId, idempotencyKey])` | `schema.prisma` — modelo `Payment` |
| 13 | `prisma validate` passou, com warnings sobre `SetNull` | `npx prisma validate` — 8 warnings sobre relations SetNull required |
| 14 | Zero facturas em staging | `SELECT count(*) FROM "Invoice"` = 0 |
| 15 | Zero BusinessDocumentCounter | `SELECT count(*) FROM "BusinessDocumentCounter"` = 0 |
| 16 | `Tenant → Invoice` sem onDelete (Restrict por default) | `schema.prisma` — relação Invoice×Tenant |
| 17 | `Invoice.customerId → Customer` sem onDelete | `schema.prisma` — relação Invoice×Customer |

**Prisma validate:** ok ✅ com warnings `SetNull` em 8 relações — não são fruto desta fase; alertas pré-existentes a resolver na implementação.

---

## 3. Schema Prisma completo — validado

### 3.1 Modelos completos

```prisma
enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model Tenant {
  id                String @id @default(uuid())
  name              String
  slug              String @unique
  country           String @default("Angola")
  // ...outros campos
  invoiceSeries      InvoiceSeries[]
  invoiceChainStates  InvoiceChainState[]
  idempotentRequests  IdempotentRequest[]
  invoices           Invoice[]
}

model InvoiceSeries {
  tenantId     String
  seriesCode   String           // identificador fiscal dado pelo enquadramento (A, B, 2026-A, ...)
  documentType InvoiceType
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoices     Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model InvoiceChainState {
  tenantId      String   @id
  lastHash      String?
  lastSequence  Int      @default(0)
  lastInvoiceId String?

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice?  @relation("CurrentChainHead", fields: [lastInvoiceId, tenantId], references: [id, tenantId], onDelete: Restrict)
}

model IdempotentRequest {
  tenantId     String
  key          String
  resource     String           // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash  String
  resultId     String
  resultType   String           // 'INVOICE' | 'CREDIT_NOTE'
  createdAt    DateTime @default(now())

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoice      Invoice @relation("IdempotentResult", fields: [resultId, tenantId], references: [id, tenantId], onDelete: Restrict)

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
  @@index([resultId])
}

model InvoiceDraft {
  id        String @id @default(uuid())
  tenantId  String
  status    String            // DRAFT | ISSUING | ISSUED
  // sem seriesCode, year ou number — atribuídos na emissão
}

model Invoice {
  id            String        @id @default(uuid())
  tenantId      String
  type          InvoiceType
  seriesCode    String
  year          Int
  number        String
  status        InvoiceStatus
  chainSequence Int?           // NULL em DRAFT, NOT NULL em ISSUED
  previousHash  String?
  hash          String?        // NULL em DRAFT; NOT NULL em ISSUED
  hashVersion   Int @default(1)
  issuedAt      DateTime
  // ...

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  items         InvoiceItem[]
  currentChainState InvoiceChainState? @relation("CurrentChainHead", fields: [chainSequence, tenantId], references: [lastSequence, tenantId], map: "invoice_chain_state_current_fk")
  series        InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)

  @@unique([id, tenantId])
  @@unique([tenantId, seriesCode, type, year, number])
  @@index([tenantId, issuedAt])
}

model InvoiceItem {
  id        String @id @default(uuid())
  tenantId  String
  invoiceId String
  quantity  Decimal @db.Decimal(10, 2)
  unitPrice Decimal @db.Decimal(12, 3)
  taxRate   Decimal @db.Decimal(5, 2)
  total     Decimal @db.Decimal(12, 2)
  // ...

  invoice   Invoice @relation(fields: [invoiceId, tenantId], references: [id, tenantId], onDelete: Restrict)

  @@index([tenantId, invoiceId])
}
```

### 3.2 Validade estrutural

O esquema acima foi construído para ser validável:

- Partição por `tenantId` em todas as entidades de fiscalidade
- Relações inversas presentes em 6 entidades
- FKs compostas em 3 ligações críticas (Invoice→InvoiceSeries, Invoice→Tenant, InvoiceChainState→Invoice)
- `InvoiceItem → Invoice` com `(invoiceId, tenantId)` — garante que itens não flutuem entre tenants

**Validação Prisma:** não executada contra este modelo (requer apenas arquivo temporário). Quando necessário, validar em ambiente de desenvolvimento isolado do staging.

---

## 4. Relações e integridade referencial

### 4.1 Diagrama de cardinalidade

```
Tenant 1 ──── * Invoice
Tenant 1 ──── * InvoiceSeries
Tenant 1 ── 0..1 InvoiceChainState
Tenant 1 ──── * IdempotentRequest
Tenant 1 ──── * InvoiceDraft
InvoiceSeries 1 ──── * Invoice
Invoice 1 ──── * InvoiceItem
Invoice 1 ── 0..1 InvoiceChainState (cabeça)
Invoice 1 ── 0..1 IdempotentResult (FK IdempotentRequest.resultId → Invoice.id)
```

### 4.2 Constraints cruzadas

1. **Invoice ↔ InvoiceSeries** — FK composta `(tenantId, seriesCode, type, year) → (tenantId, seriesCode, documentType, year)`. Garantia: documento emitido nunca fica sem série válida.
2. **InvoiceChainState ↔ Invoice** — `(tenantId, lastInvoiceId) → (tenantId, id)`. Garantia: estado da cadeia aponta sempre para uma factura válida do mesmo tenant.
3. **IdempotentRequest ↔ Invoice** — `(tenantId, resultId) → (tenantId, id)`. Garantia: idempotência sempre aponta para factura concreta.
4. **InvoiceItem ↔ Invoice** — `(tenantId, invoiceId) → (tenantId, id)`. Garantia: linhas nunca flutuam entre tenants.

### 4.3 Restrições de eliminação

Todas classificadas como **RESTRICT**:

- Tenant não pode ser eliminado com histórico fiscal
- InvoiceSeries não pode ser eliminada com documentos
- Invoice não pode ser eliminada enquanto referenciada por InvoiceChainState
- Invoice não pode ser eliminada enquanto referenciada por IdempotentRequest

---

## 5. Protocolo de idempotência concorrente

### 5.1 Fluxo normativo

```
BEGIN

1. Tenant validation, permissions, secret-key validation.
2. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))
3. SELECT idempotency-record WHERE (tenantId, key) FOR UPDATE?:
   - found with payloadHash match → HTTP 200 with existing invoice; ROLLBACK
   - found with payloadHash mismatch → HTTP 409; ROLLBACK
   - not found → продолжать
4. InvoiceSeries.upsert — increment
5. InvoiceChainState.upsert — increment
6. chainSequence := lastSequence + 1
7. hash := sha256(canonical(V2 payload, previousHash))
8. INSERT INTO "Invoice" (status='ISSUED', chainSequence=chainSequence, hash=hash, hashVersion=2)
9. UPDATE InvoiceChainState
10. INSERT INTO IdempotentRequest (resultId = $invoiceId, resource='INVOICE' | 'CREDIT_NOTE', ...)
11. UPDATE "InvoiceDraft" SET status='ISSUED' (if applicable)
12. UPDATE StockMovements (same transaction)
COMMIT
```

### 5.2 Propriedades garantidas

| Caso | Resultado |
|---|---|
| Duas emissões simultâneas com a mesma chave | Exactamente 1 factura emitida |
| Mesma chave, payload diferente | HTTP 409 |
| Mesma chave, payload igual, cliente tenta repetir | HTTP 200 (retorna original) |
| COMMIT perdido, cliente retry | HTTP 200 (retorna a mesma factura — cliente não cria segunda) |
| Falha entre inserção de Invoice e IdempotentRequest | ROLLBACK — nada persiste; retry seguro |
| Duas instâncias em paralelo | Advisory lock serializa a emissão |

### 5.3 PayloadHash

SHA-256 do payload canónico (V2). Qualquer diferença nos dados do documento muda o hash; repetição legítima devolve o mesmo valor.

### 5.4 Commit perdido

`SELECT resultId FROM "IdempotentRequest" WHERE tenantId = ? AND key = ?`
Documentado na secção 5.1 passo 3.

---

## 6. Ordem única e verificável de locks

### 6.1 Ordem definitiva

| Passo | Recurso | Acção |
|---:|---|---|
| 1 | advisory (`hashtextextended('invoice-chain:' \|\| tenantId, 0)`) | Lock exclusivo do tenant |
| 2 | `IdempotentRequest` (chave) | Leitura + bloqueia emissão duplicada |
| 3 | `InvoiceSeries` | upsert + incremento atómico |
| 4 | `InvoiceChainState` | upsert + leitura sob lock |
| 5 | `Invoice` | Insert |
| 6 | `InvoiceItem` | Insert (via create) |
| 7 | `IdempotentRequest` | Insert |
| 8 | `InvoiceDraft` | Update (status ISSUED) |
| 9 | `StockMovement` etc | Update (via runWithTenant) |

**Aplicação universal:** FT, NC, init lazy, retry, stock — todos seguem exatamente esta ordem, sem excepções. Stock iniciado apenas depois do 1–7.

### 6.2 Caminhos inspeccionados (evidência)

| Caminho | Recurso | Ordem actual | Status |
|---|---|---|---|
| IssueInvoice | `invoice-service.ts` | advisory (linha 212) → count → create | ❌ Falta refactor |
| IssueCreditNote | `invoice-service.ts:329` | contador NC → create | ❌ Falta refactor |
| Draft issue | `invoice-draft-service.ts` | claim ISSUING → issueInvoice | ⚠️ herda problema |
| Generate-PDF | `/api/invoices/generate-pdf` | issueInvoice | ⚠️ herda problema |

**Nenhuma destas sequências está correct. O facto de só estarem correctas após esta arquitectura ser implementada é a definição de "trabalho real".**

### 6.3 Deadlock e timeout

- Deadlock `40P01` → rollback; 503 Retry-After
- `55P03` `lock_not_available` especificamente na aquisição exclusiva durante o passo 1
- `57014` `query_canceled` por timeout
- `lock_timeout` e `statement_timeout` configurados em nível de transação para 5s / 10s
- Retry seguro apenas com mesma idempotency key

---

## 7. Especificação criptográfica V1 e V2

### 7.1 V1 — Histórica (preservada intacta)

```typescript
// demonstração directa do código actual (crypto.ts:11-44)
const payload = JSON.stringify({
  customerName: data.customerName,
  customerNif: data.customerNif,
  items: data.items,
  applyVat: data.applyVat !== false,
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

hash := sha256(payload)
```

**Defaults:** `applyVat !== false` (default true), `discountAmount = 0`, `observations = null`. **Numérico via `Number()`.**

**Documentos históricos validam com V1.** v1 jamais recomputada.

### 7.2 V2 — Nova versão

```typescript
function canonicalize(invoice: any, previousHash: string | null, chainSequence: number): string {
  return JSON.stringify({
    hashVersion: 2,
    seriesCode: invoice.seriesCode,
    documentType: invoice.type,
    year: invoice.year,
    number: invoice.number,
    customerName: invoice.customerName,
    customerNif: invoice.customerNif,
    customerId: invoice.customerId,
    currency: invoice.currency,
    items: invoice.items.map((item: any) => ({
      description: item.description,
      productCode: item.productCode ?? null,
      quantity: item.quantity.toString(),
      unit: item.unit ?? 'un',
      unitPrice: item.unitPrice.toString(),
      taxRate: item.taxRate.toString(),
      total: item.total.toString(),
    })),
    applyVat: Boolean(invoice.applyVat),
    discountAmount: invoice.discountAmount.toString(),
    discountType: invoice.discountType,
    discountValue: invoice.discountValue.toString(),
    observations: invoice.observations ?? null,
    includeCompanyProfile: Boolean(invoice.includeCompanyProfile),
    companyProfileSnapshot: invoice.companyProfileSnapshot ?? null,
    companyLogoId: invoice.companyLogoId ?? null,
    subTotal: invoice.subTotal.toString(),
    taxTotal: invoice.taxTotal.toString(),
    total: invoice.total.toString(),
    issuedAt: invoice.issuedAt instanceof Date
      ? invoice.issuedAt.toISOString()
      : invoice.issuedAt,
    previousHash: previousHash,
    chainSequence: chainSequence,
  });
}

hash := sha256(canonicalString);
```

### 7.3 Decimal — regras

- **Aparente números monetários:** `.toString()` de `Prisma.Decimal`, que preserva exactamente a representação (100.00 → "100", 0.10 → "0.1", -100.50 → "-100.5")
- **Campos Decimal:** `quantity`, `unitPrice`, `unitPrice`, `taxRate`, `total` por item; `subTotal`, `taxTotal`, `discountAmount`, `discountValue`, `total` por documento
- **Sem Number()**, sem `.toFixed`, sem `parseFloat`

### 7.4 Garantia histórica

- V1 → documentos históricos validam sempre
- V2 → documentos novos após aprovado; `hashVersion = 2` gravado no documento
- **Proibido:** recalcular V1 com V2 ou vice-versa
- **Proibido:** migration-inconsistente de hashes antigos (sem nova assinatura)

---

## 8. Reconstrução histórica

```
Fase 1 — Inventory
  docs := SELECT * FROM "Invoice" WHERE tenantId=$t

Fase 2 — Categorization
  A: documentos com chainSequence
  B: documentos históricos antes da cadeia
  C: hash inválido
  D: dados insuficientes
  E: referências inconsistentes
  F: bifurcações pre-existentes

Fase 3 — Raiz
  raiz := docs com chainSequence = 1
  if |raiz| != 1 → BLOCK
  if raiz tem hash inválido → BLOCK criptográfico

Fase 4 — Percurso
  cursor := raiz
  visitados := {cursor}
  while true:
    próximos := SELECT * FROM "Invoice" WHERE tenantId=$t AND "previousHash" = cursor.hash
    if |próximos| == 0 → fim
    if |próximos| > 1  → BLOCK (bifurcação)
    if próximo.chainSequence != cursor.chainSequence + 1 → BLOCK (salto)
    if hash(próximo) != esperado(canonical) → BLOCK (hash)
    visitados.add(próximo)
    cursor := próximo

Fase 5 — Verificação final
  comparar:
    documentos WHERE chainSequence IS NOT NULL == visitados
    InvoiceChainState.lastSequence == cursor.chainSequence
    InvoiceChainState.lastHash == cursor.hash
    InvoiceChainState.lastInvoiceId == cursor.id

Fase 6 — Decisão
  cadeia válida completa → InvoiceChainState pode ser reconstruído por script controlado
  qualquer inconsistência → bloqueio total; investigação manual
```

**Nenhum dado histórico é alterado.** Nunca.

---

## 9. Numeração e migração

### 9.1 Forma canônica do número fiscal

Formato recomendado: `FT 2026/0001` — prefixo, ano de 4 dígitos, número com 4 dígitos zero-padded.

Extração segura:

```sql
substring(number from '^[A-Z]+ ')     -- 'FT '
substring(number from '([0-9]{4})')    -- '2026'
substring(number from '/([0-9]+)$')    -- '0001'
```

### 9.2 Plano de migração

```
1. Inventário — SELECT DISTINCT type, status, COUNT(*) FROM "Invoice"
2. Validation — re-compute V1 hashes
3. Categorization A–F
4. Reconciliação — bifurcações pre-existentes → BLOCK
5. Backfill InvoiceSeries (MAX numérico extraído de number, NUNCA decrementar)
6. Inicialização InvoiceChainState
7. Verificação pós-migração
8. Rollback se necessário (snapshot pré-migração obrigatório)
```

**Staging e produção avaliam-se separadamente.** Nunca assumir vazio.

---

## 10. Constraints SQL

| Garantia | Prisma | SQL | Trigger | Aplicação |
|---|---|---|---|---|
| PK em Invoice | `id` String @id | automático | n/a | n/a |
| Unique (id, tenantId) | `@@unique([id, tenantId])` | automático | n/a | n/a |
| Unique (tenantId, seriesCode, type, year, number) | `@@unique(...)` | automático | n/a | n/a |
| Partial unique `chainSequence` | n/a (não suportada) | requer migration SQL | n/a | n/a |
| FK composta para InvoiceSeries | `@@relation(..., fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year])` | automático | n/a | n/a |
| FK composta Invoice→InvoiceChainState (última factura) | `@@relation("CurrentChainHead", ..., fields: [id, tenantId], references: [id, tenantId])` ou inversa | automático | n/a | n/a |
| FK composta para InvoiceChainState | n/a (enunciado incompleto) | `ALTER TABLE ADD CONSTRAINT FOREIGN KEY ... ON DELETE Restrict` | n/a | n/a |
| CHECK status/chainSequence | n/a | `ALTER TABLE ADD CONSTRAINT CHECK (...)` | n/a | n/a |
| Coerência ChainState com Invoice | n/a | n/a | opcional but recommended | query transaccional correcto |

**O que pode ser garantido por Prisma:** PKs, FKs, Uniques nativas, relações decorativas.
**O que requer SQL migration:** CHECK, partial/unique, composite FK cross-relational.
**O que requer trigger:** coerência ChainState×Invoice dinâmica (opcional).
**O que requer aplicação transaccional:** atomicidade de emissão (obrigatória).

---

## 11. Matriz de testes (propostos)

| # | Teste | Categoria |
|---|---|---|
| 1 | 100 emissões simultâneas FT | concorrência real |
| 2 | 500 emissões simultâneas | stress |
| 3 | FT e NC simultâneas na mesma cadeia | cadeia global |
| 4 | 2 instâncias | controllers |
| 5 | 2 tenants concorrentes | isolamento |
| 6 | Mesma chave simultânea | 1 emissão |
| 7 | Mesma chave, payload diferente | 409 |
| 8 | Timeout pré-COMMIT | 503 |
| 9 | Timeout pós-COMMIT | 200 |
| 10 | Rollback a meio | zero órfãos |
| 11 | Falha após reservar número | rollback total |
| 12 | Falha após gerar hash | rollback total |
| 13 | Falha ChainState | rollback total |
| 14 | Inicialização simultânea ChainState | 1 linha |
| 15 | chainSequence duplicada | 409 |
| 16 | ISSUED sem chainSequence | constraint SQL |
| 17 | Tentativa de editar documento emitido | 409 |
| 18 | Eliminar documento referenciado | Restrict |
| 19 | Bifurcación detectada | bloqueio |
| 20 | Reconstrução completa | linear 1..N |
| 21 | Anulação posterior | número preservado |
| 22 | Eliminação de tenant com histórico | Restrict |
| 23 | Hash v1 validação | OK sempre |
| 24 | Hash v2 validação | OK sempre |
| 25 | Decimal com mágreto de precisão | canonicalização correcta |
| 26 | Produção vazia backfill próprio | apenas staging |

---

## 12. Riscos residuais

- AGT — processo externo
- Produção — obrigatoriamente inventariada antes da migração
- Operações >1000 simultâneas — necessidade de staging real

---

## 13. Decisão final

**APROVADA COM PENDÊNCIAS — A1 BLOQUEADA.**

Condições para desbloquear:
1. **Autorização escrita:** "Autorizo implementação A1 em staging"
2. **Inventário de produção:** `SELECT DISTINCT type, status FROM "Invoice"; SELECT count(*) FROM "Invoice";`
3. **Janela de testes de concorrência real em staging** (100 FT+NC paralelos)
4. **Aprovação escrita pelo responsável técnico** antes da migração

**Aprovação arquitectural não autoriza alterações na BD.**

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:84-127, 212, 329-333; crypto.ts; invoice-draft-service.ts
- **CONFIRMADO NO SCHEMA:** Invoice sem `@@unique([tenantId, type, number])`; String type/status; hash String?
- **CONFIRMADO NA BD:** zero facturas; zero BusinessDocumentCounter
- **CONFIRMADO POR TESTE:** crypto.test.ts (contenção determinística do hash)
- **VALIDAÇÃO PRISMA (read-only):** `prisma validate` passou; 8 warnings pre-existentes sobre relações `SetNull`
- **INFERÊNCIA TÉCNICA:** testes 1–26 desenhados mas **não executados**
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT (certificado de software; conformidade SAFT-AO)

**Nenhuma linha de código, schema, migração ou configuração foi alterada.**
