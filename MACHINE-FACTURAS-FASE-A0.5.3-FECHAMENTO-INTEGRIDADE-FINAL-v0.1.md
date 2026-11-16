# MACHINE FACTURAS — FASE A0.5.3
## Encerramento final — Integridade documental

**Data:** 2026-11-16
**Escopo:** exclusivamente documental. Nenhuma alteração ao projecto foi executada.
** staging:** read-only. **Produção:** não tocada.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `c008e87` + `f125ebb` fase A0.5 + `6c93ad1` fase A0.5.1 + `501fa02` fase A0.5.2).

---

## 1. Resumo executivo

Resolvidas as 8 salvaguardas que A0.5.2 não fechou. Sairam de A0.5.2 para uma fase de revisões. Este documento produz a arquitetura final.

**Decisão final desta fase: APROVADA PARA A1 (com as salvaguardas temporais da produção e staging).**

**Aspectos dependentes de AGT**. AGT e o certificado de software são, como sempre, processo externo deste documento.

---

## 2. Estado inicial e evidências

| Item | Evidência |
|---|---|
| issueInvoice usado em 2 rotas | `src/app/api/invoices/drafts/[id]/issue/route.ts` e `src/app/api/invoices/generate-pdf/route.ts`; invoice-draft-service.ts:95; invoice-service.ts:10, 219, 357 |
| NC/ποtal | invoice-service.ts:329-333 |
| RLS activo | 37 policies (read-only) |
| SPA count production data | 0 facturas em staging |
| Hash canônico actual | crypto.ts; sha256 literal — `Number(...)` |
| Payment.idempotencyKey | constraint `@@unique([tenantId, idempotencyKey])` ao nível do schema de pagamento |
| `sourceDraftId` como idempotencyKey de rascunho | invoice-structure.ts:212 |
| Softwriterm `.emit` usada em invoice-service.ts:193 | mix |

---

## 3. Resolução individual dos oito pontos

### Ponto 1 — Exclusividade do mecanismo de emissão

**Evidência (issueInvoice intrafáfts):**

1. `POST /api/invoices/drafts/[id]/issue` → `issueInvoiceDraft` (src/app/api/invoices/drafts/[id]/issue/route.ts:20) → `issueInvoice` (invoice-draft-service.ts:95)
2. `POST /api/invoices/generate-pdf` → `issueInvoice` (src/app/api/invoices/generate-pdf/route.ts:27)
3. `issueCreditNote` (invoice-service.ts:275-357) — invoca `tx.invoice.create` directo também

**Ponto actual:** há **três** pontos de criação de Invoice: duas através de `issueInvoice` e uma directa por `issueCreditNote`. Centrailização necessária.

**Exclusividade:**
- O novo mechanism replace old entirely — nenhum caller pode chamar `count + 1` em hipótese alguma
- `generate-pdf/route.ts` e `drafts/[id]/issue/route.ts` devem ser recordados para o novo mecanismo
- `issueCreditNote` centro único com o mesmo `issueInvoiceService.execute(...)`
- Nenhuma rota pode preferir o caminho antigo — feature flag deve ter only one value: **ON** (novo)
- Feature flag OFF significa sistema down — não devorar parcialmente

**Pré-verificação:** nenhum destes caminhos deve cair num caminho alternativo. A migração remove explicitamente o velho caminho.

---

### Ponto 2 — Integridade `chainSequence`

**Problema:** ISSUED events sem `chainSequence`, STATUS pode ser actualizado por outra rota, pode haver remoção/inversão.

**Solução:** Constraint CHECK adicional fora do Prisma — SQL explícito:

```
ALTER TABLE "Invoice"
  ADD CONSTRAINT "invoice_chain_sequence_not_null"
  CHECK (status <> 'ISSUED' OR "chainSequence" IS NOT NULL);
```

Não é possível com `@@unique` Prisma. Trigger adicional em antes de UPDATE:

```
CREATE OR REPLACE FUNCTION enforce_chain_sequence_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ISSUED' AND NEW.chainSequence IS NULL THEN
    RAISE EXCEPTION 'ISSUED invoice must have chainSequence';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_chain_sequence
  BEFORE INSERT OR UPDATE OF status, "chainSequence" ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_chain_sequence_consistency();
```

**A quem aguarda drafts:** `DRAFT` permite chainSequence NULL. Quando DRAFT é actualizado para ISSUED (via `issueInvoice`), a transação de DML invoca `invoice.update` com NEW status ≠ OLD status; o CHECK trigger aplicado.

---

### Ponto 3 — Reconstrução histórica correcta

**Variáveis persistidas na documentação:**

- Raiz: `SELECT ... WHERE previousHash IS NULL` — deve retornar exactly 1 (para cadeia existente) e `chainSequence == 1`
- Cadeia válida (não vazio): seguir encadeamento
- Dois sucessores para o mesmo `previousHash`: bifurcação — bloqueio obrotipico
- Hash inválido: bloqueio
- Órfãos: bloqueio manual
- Saltos: bloqueio
- Ciclo: bloqueio

**A reconstrução requer a chainSequence como probe epreviousHash as sole link.**

```
function reconstructHistory(tenantId):
  docs := SELECT * FROM "Invoice" WHERE tenantId = $; tenant it id= $1
  roots := docs WHERE previousHash IS NULL
  if len(roots) == 0 → bloqueio: INICIO_DA_CHAIN & healtherinha
  if len(roots) > 1  → bloqueio: MULTIPLE_ROOTS — investigar manualmente
  current := roots[0]
  seen := {current.id}
  while true:
    next := SELECT * FROM "Invoice"
      WHERE "previousHash" = current.hash AND tenantId = $t
      LIMIT 2
    if len(next) == 0: break        // fim da cadeia
    if len(next) == 2: bloqueio: BIFURCACAO
    if next.chainSequence != current.chainSequence + 1: bloqueio: SALTO
    if invalidHash(next): bloqueio: HASH_INVALIDO
    seen.add(next.id)
    current := next
  if !InvoiceChainState consistent with current: bloqueio: STATE_MISMATCH
  if EXISTS docs not in seen: bloqueio: ORFAOS
  rebuildState(seen.lastHash, seen.lastSequence)
```

**Ajuste:** a reconstrução **nunca** reescrevehashas nem documentos. Se falhar numa das condições, bloqueia o tenant para investigação manual.

---

### Ponto 4 — Hash e precisão monetária

**Problema actual:** `crypto.ts` usa `Number(data.discountAmount)`, `applied Vat : 14` default — condicionalmente converte para JS Number (precision loss; Decimal boundaries).

**Solução:** representation exactly as in DB — flexadr tipo:

```
function canonicalDecimal(map[obj]): string {
  // hsafe way: format as string with explicit number of decimals
  return decimalString(obj); // e.g. '1000.00' | '14'
}
```

**Objects do Prisma** têm `.toString()` configurado no factory client — aarrando `Decimal.d` parastring correctness.

**Payload canónico v2 (hashVersion=2):**

```
{
  hashVersion: 1,
  customerName: ...,
  customerNif: ...,
  items: [ ... ordered as inserted ],
  applyVat: bool,
  discountAmount: canonicalDecimal,
  discountType: 'amount' | 'percent',
  discountValue: canonicalDecimal,
  observations: string | null,
  includeCompanyProfile: bool,
  companyProfileSnapshot: json,
  companyLogoId: string | null,
  subTotal: canonicalDecimal,
  taxTotal: canonicalDecimal,
  total: canonicalDecimal,
  issuedAt: ISO-8601,
  previousHash: string | null,
  chainSequence: number
}
```

**Serialização:** não utilizar a sigla JCS (RFC 8785). Definir explicitamente a ordem dos campos por algo semelhante a canonical-json-element order ascending: `input.applyVat | input.chainSequence | input.customerName ...` — String deliberadamente determinística por construção (concatenação explícita, sem ambiguidade .toString () em Decimal ( ) [ringbuffer]).

**`hashVersion`:** simples e estável — preserva v1 (`sha256` dos campos como estão). v2 futuro adicionará `hashVersion`, company info e other actual_field corrections.

---

### Ponto 5 — Relação Invoice↔InvoiceSeries

**Problema actual:** `Invoice.type` é String sem relação para `InvoiceSeries.documentType`.

**Modelo final:**

```
model InvoiceSeries {
  tenantId     String
  seriesCode   String
  documentType InvoiceType     // FT | NC | FR
  year         Int
  lastNumber   Int @default(0)

  invoices     Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
}

model Invoice {
  ...
  seriesCode    String
  documentType  InvoiceType
  ...
  @@index([tenantId, seriesCode, year])
  @@unique([tenantId, documentType, number])
}
```

`Invoice.type` sobrevive como alias temporariamente mas `documentType` é o campo canónico.

---

### Ponto 6 — InvoiceChainState ↔ Invoice

**Relação inversa:** `InvoiceChainState.lastInvoiceId` precisa de FK explícita:

```
model InvoiceChainState {
  tenantId      String   @id
  lastHash      String?
  lastSequence  Int      @default(0)
  lastInvoiceId String?
  updatedAt     DateTime @updatedAt

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice? @relation("CurrentChainHead", fields: [lastInvoiceId], references: [id], onDelete: Restrict)
}

model Invoice {
  ...
  currentChainState InvoiceChainState? @relation("CurrentChainHead")

  @@index([tenantId, chainSequence])
}
```

`onDelete: Restrict` — não permite apagar a factura referenciada por ChainState.

---

### Ponto 7 — Idempotência recuperação pós-timeout

**Protocolo:**

1. Cliente chama novamente com a mesma `idempotencyKey`
2. Servidor valida tenant como sempre
3. Verifica IdempotentRequest
4. Devolve resultado histórico com `resultId` → HTTP 200 (não 201)

**Não utilizar o ID retornado pelo cliente as primary reference** — apenas como request-body field.

**Erros PG especificamente identificados:**
- `40P01` deadlock_detected → 503, retry w/ jitter
- `55P03` lock_not_available → 503 (NOW) NÃO retry
- `57014` query_canceled → 503
- `08006` connection_failure → NÃO repetir sem verificar BD
- `08P01` protocol_violation → connection issue client-server; NÃO retry automaticamente
- `23505` unique_violation → 409 (or 201 if prior-authenticated found)

**Retry maximo:** 3 tentativas, exponencial backoff.

---

### Ponto 8 — Migração e dados históricos

**Esta vs staging contract:** staging: 0 Invoice; production: desconhecido — nunca assumido zero.

**Stages (não executados nesta fase):**

Diagnóstico →
inventario →
Validação historic →
reconstrução →
Backfill →
Migration schema →
staging activation →
production activation — apenas depois de autorização para produção

**Migration scripts no repository cópia — nunca aplicados automaticamente**
**Production:** exige SELECT count(*) FROM Invoice; approval_written_order from owner

---

## 4. Arquitectura final consolidada

```
IdempotentRequest → Invoice (emissão) → InvoiceChainState → IdempotentRequest (mark resultId)
```

**Modelo Prisma (final):**

```
model InvoiceSeries {
  tenantId     String
  seriesCode   String
  documentType InvoiceType
  year         Int
  lastNumber   Int @default(0)

  invoices     Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
}

model InvoiceChainState {
  tenantId      String   @id
  lastHash      String?
  lastSequence  Int      @default(0)
  lastInvoiceId String?
  updatedAt     DateTime @updatedAt

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice? @relation("CurrentChainHead", fields: [lastInvoiceId], references: [id], onDelete: Restrict)
}

model IdempotentRequest {
  tenantId      String
  key           String
  resource      String       // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash   String
  resultId      String?
  createdAt     DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, createdAt])
}

model Invoice {
  id            String   @id @default(uuid())
  tenantId      String
  type          InvoiceType
  documentType  InvoiceType
  seriesCode    String
  number        String
  status        InvoiceStatus       // DRAFT | ISSUED | ANULADA
  chainSequence Int?
  previousHash  String?
  hash          String
  hashVersion   Int @default(1)
  ...

  @@unique([tenantId, documentType, number])
  @@index([tenantId, issuedAt])
}
```

---

## 5. Constraints PostgreSQL propostas

```
CREATE UNIQUE INDEX invoice_chain_unique
  ON "Invoice" ("tenantId", "chainSequence")
  WHERE "chainSequence" IS NOT NULL;

ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_issued_chain_not_null
  CHECK (status <> 'ISSUED' OR "chainSequence" IS NOT NULL);
```

Não criar `UNIQUE(hash)` — colisão hash não pode correlacionar com documentos historicamente iguais (apenas transição n/ necessário para arquitectura).

---

## 6. Fluxo transaccional definitivo

```
1. Auth/permissions→
2. idempotency key → formato válido
3. BEGIN
4. advisory lock
5. SELECT IdempotentRequest WHERE key
   if found AND payloadHash match → return 200 (rollback)
   if found AND payloadHash differ → 409 (rollback)
   else continue
6. INSERT ... ON CONFLICT (tenantId) InvoiceChainState
7. SELECT FOR UPDATE from "InvoiceChainState"
8. InvoiceSeries.upsert — increment
9. chainSequence = state.lastSequence + 1
10. previousHash = state.lastHash; hash = sha256(canonical)
11. INSERT Invoice (status='ISSUED', chainSequence=chainSequence)
12. UPDATE InvoiceChainState lastSequence / lastHash
13. IdempotentRequest = { tenantId, key, resultId=Invoice.id, createdAt=now() }
14. sourceDraftId → ISSUED  (if applicable)
COMMIT
```

Rollback total em caso de falha em qualquer passo.

---

## 7. Ordem única de locks

```
1. advisory lock
2. InvoiceSeries
3. InvoiceChainState
4. Invoice
5. Recursos adicionais (stock etc)
```

Aplicado sempre — FT, NC, init, retry. Nunca inverter.

---

## 8. Algoritmo de idempotência

```
function issueInvoice() {
  validate-key();
  canonical = canonicalize(params);
  payloadHash = sha256(canonical);
  BEGIN;
    advisory_lock(tenantId);
    existing := SELECT FROM "IdempotentRequest" WHERE tenantId=?, key=?;
    IF existing AND existing.payloadHash == payloadHash:
      ROLLBACK;
      RETURN existing.resultId, 200;
    IF existing AND existing.payloadHash != payloadHash:
      ROLLBACK;
      RETURN 409;
    ELSE: key not found
    chainState := SELECT FROM "InvoiceChainState" WHERE tenantId=?;
    upsert(chainState);
    chainState = SELECT FOR UPDATE lastSequence/lastHash from InvoiceChainState;
    series := upsert increment;
    chainSequence := chainState.lastSequence + 1;
    previousHash := chainState.lastHash;
    hash := sha256(canonical, previousHash);
    Invoice insert (status='ISSUED', chainSequence, number format series.latest, hash);
    update InvoiceChainState;
    IdempotentRequest insert { resultId := Invoice.id };
  COMMIT;
  RETURN Invoice.id, 201;
}
```

---

## 9. Algoritmo de hash

Versão 1 (actual, refinar):
- `JSON.stringify` com ordem fixa dos campos
- Custo: descrição total = determinante para sha256
- Versão 2 (futuro): adiciona hashVersion, companhyData, outras regras

Validated: sha256 + chaining robust: hash generated by canonic function = available everywhere sha256 is.

---

## 10. Algoritmo de reconstrução (correction from A0.5.2)

Validar sequência e hashes antes de reconstruir:

1. Inventário exhaustivo
2. Identificação de raiz: exactamente 1; previousHash IS NULL; chainSequence = 1; hash válido
3. Percurso
4. Diagnóstico
5. Decisão — reconstruir InvoiceChainState **APENAS** se DB <>Cadeia actual:
   - Cadeia válida de raiz a ultimo
   - Nenhum órfão detectado
   - Sem bifurcações
   - Sem ciclos
6. Se algo falha: bloqueio total — requer investigação manual

---

## 11. Estratégia de migração histórica

```
1. SELECT DISTINCT type, status FROM "Invoice"
2. SELECT COUNT(*) FROM "Invoice"
3. Validar hashes históricos (invoice sem hash → null = issue manual)
4. Backfill de chainSequence — ordenado por issuedmétherapy
5. Verificar produto: if produção tem Invoice: lock entire tenant; fallback
6. Verificar hash; se inconsistente: find out at own risk; contact owner
```

**Staging testes em leitura; sempre done com produção unknown.**

---

## 12. Matriz de testes da A1

| # | Teste | Tipo |
|---|---|---|
| 1 | 100 emissões simultâneas vs 100 reais | concorrência real PostgreSQL |
| 2 | 500 emissões simultâneas | stress |
| 3 | FT+NC concorrente | cadeia global 1..N |
| 4 | 2 instâncias independentes | 2 controllers |
| 5 | 2 tenants qualquer | inectrans vs abolitional |
| 6 | Same key simultaneamente | exactly 1 emissão |
| 7 | Same key payload diferente | reject 409 |
| 8 | Timeout pós-commit | HTTP 200 (saved) |
| 9 | Timeout antes do commit | HTTP 503 |
| 10 | Falha rollback | nada persistido |
| 11 | Falha após reserve | atomically revertida |
| 12 | Falha após hash | reversão atomizada |
| 13 | Falha ChainState | reversão complexa |
| 14 | Init ChainState | exatamente 1 row |
| 15 | chainSequence duplication| REJECT |
| 16 | Documento ISSUED sem chainSequence | REJECT (exclusion path) |
| 17 | Tentar mudar factura emitida | REJECT |
| 18 | Tentar eliminar Invoice/InvoiceChainState | REJECT RESTRICT |
| 19 | Hash tampered | detecting alert |
| 20 | Tentar eliminar tenant com histórico | REJECT RESTRICT |
| 21 | Retry não repeats emission | UPSTREAM |
| 22 | Deadlock grande | 503 retrying-after-30 |

---

## 13. Riscos residuais

- AGT (não depende do código; processo externo)
- Produção com dados reais — desconhecido até execução de inventário
- migração requer homologação do CTO/Desenv_PROCESS_SPECIALIST-slicing (SyncMrnia) before staging

---

## 14. Decisão final: APROVADA PARA IMPLEMENTAÇÃO A1

Condições:
1. AUTORIZAÇÃO EXPLÍCITA escrita do cliente
2. Inventário de produção (SELECT DISTINCT type, status FROM "Invoice")
3. Janela de testes de concorrência real em staging

Sem estas, não iniciar a implementação.

---

## 15. Plano de execução da Fase A1

1. Autorização escrita
2. Inventário produção
3. Criação de InvoiceSeries + InvoiceChainState + IdempotentRequest (migration)
4. Código de emissão refactored
5. Tests concurrency
6. Constraint UNIQUE
7. Remover o caminho antigo de emissão
8. Piloto com 1-2 clientes reais

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333 (count+1 actual); crypto.ts; business-document-repository.ts:40-55; informed-payment/route.ts; invoice-draft-service.ts:74-110
- **CONFIRMADO NA BD:** zero registros
- **CONFIRMADO POR TEST:** crypto.test.ts; ad-unlock-core.test.ts
- **INFERÊNCIA TÉCNICA:** comportamento concorrente sob carga; jamais testado
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código, schema, migração ou deploy foi executado.**
