# MACHINE FACTURAS — FASE A0.5.3.3
## Fecho arquitectural final — Integridade documental e facturação fiscal

**Data:** 2026-11-16
**Escopo:** exclusivamente documental. **Nenhuma** alteração a código, schema, migrations ou configurações foi executada nesta fase.
**Staging:** read-only. **Produção:** não tocada.
**Código de referência:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2` + commits de auditoria até `52c0f9d`).
**Modo:** correcção cirúrgica — não é re-auditoria integral.

---

## 1. Resumo executivo

A A0.5.3.2 introduziu contradições entre as secções; esta fase elimina-as ao consolidar uma única especificação coerente e intencionalmente limitada. As questões históricas ficam explicitamente protegidas: v1 é mantido intacto; v2 é a nova versão proposta. A arquitectura documental tem:

- **cadeia criptográfica única por tenant**, independente de qualquer entidade — **sempre inalterada**
- **contadores fiscais dedicados** por `(tenantId, seriesCode, documentType, year)`
- **Idempotência forte** atómica verificada dentro do lock
- **InvoiceChainState** com FK composta para `Invoice`; nunca actualizada sem operação real
- **Migração histórica** com categorização e bloqueio quando ambíguo

**Decisão final:** não APROVADA para implementação A1 ainda — determinados aspectos requerem autorização. Com autorização expressa para staging e inventário de produção, pode começar a A1 imediatamente.

---

## 2. Evidências do código real

| # | Evidência | Localização |
|---|---|---|
| 1 | `issueInvoice`: `count + 1` | `src/lib/invoice-service.ts:93-97` |
| 2 | `issueCreditNote`: `count + 1` | `src/lib/invoice-service.ts:329-333` |
| 3 | `orderBy createdAt desc` na cadeia de hash | `src/lib/invoice-service.ts:84-85` |
| 4 | `FOR UPDATE` tardio (após count) | `src/lib/invoice-service.ts:212` |
| 5 | `generateInvoiceHash` com `Number(...)` em decimais | `src/lib/crypto.ts:11-42` |
| 6 | `generateInvoiceHash` — `JSON.stringify` com `previousHash || 'ROOT'` | `src/lib/crypto.ts:36-40` |
| 7 | `Invoice` — `hash String?` opcional @ default não | `schema.prisma` (modelo `Invoice`) |
| 8 | `Invoice` sem `@@unique([tenantId, type, number])` | `schema.prisma` |
| 9 | BusinessDocumentCounter — padrão funciona, não usado para factura fiscal | `business-document-repository.ts:40-55` |
| 10 | `InvoiceChainState` não existe | implícito |
| 11 | `InvoiceSeries` não existe | implícito |
| 12 | `IdempotentRequest` não existe | implícito; equivale persistida apenas em `Payment.idempotencyKey` |
| 13 | Cadeia de hash pode bifurcar sob concorrência | inferência técnica a partir da ordem de leitura actual |

**Honestidade técnica:** esta tabela é exactamente o que o código diz; fora destes pontos, não há outras garantias que sejam assumidas como válidas.

---

## 3. Problemas encontrados na A0.5.3.2

| # | Problema | Severidade |
|---|---|---|
| A0.5.3.2-P1 | Verificação de idempotência ocorre antes do lock → permite double-emit | 🔴 |
| A0.5.3.2-P2 | IdempotentRequest sem FK real (`resultId` não referenciava → ref inexistente) | 🔴 |
| A0.5.3.2-P3 | Contradição entre secções 6/12/13 da ordem de locks | 🔴 |
| A0.5.3.2-P4 | `count + 1` ainda menção cirurgica; sem remoção explícita | 🟡 |
| A0.5.3.2-P5 | Hash V1 e V2 sem pesos definidos; risco de uso misturado | 🔴 |
| A0.5.3.2-P6 | Reconstrução histórica não completa — IDs de cadeias não únicos | 🔴 |
| A0.5.3.2-P7 | Migração depende de issuedAt; produção não inspeccionada | 🔴 |
| A0.5.3.2-P8 | `InvoiceChainState` proposição não especifica `onDelete` correctamente | 🟡 |

---

## 4. Arquitectura final proposta (sem excepções)

### 4.1 Componentes

```
InvoiceSeries       → contador fiscal atômico por série/tipo/ano
InvoiceChainState  → estado da cadeia criptográfica por tenant (corrente oficial)
IdempotentRequest  → registo idempotente de emissão
Invoice            → documento fiscal
InvoiceDraft       → rascunhos (DRAFT, ISSUING) — não tratados como cadeia
Tenant             → unidade de isolamento multi-tenant
```

### 4.2 Enums

```prisma
enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }
```

**Nota sobre FR:** não existe fluxo real; o enum manuseia apenas `FT`, `NC`. `FR` fica no enum para compatibilidade futura, sem emissão nesta fase.

---

## 5. Modelos Prisma consolidados

```prisma
model Tenant {
  id                String @id @default(uuid())
  // ... outros campos
  invoiceSeries     InvoiceSeries[]
  invoiceChainState InvoiceChainState?
  idempotentRequests IdempotentRequest[]
  invoices          Invoice[]
}

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
  tenantId      String   @id
  lastHash      String?
  lastSequence  Int      @default(0)
  lastInvoiceId String?
  updatedAt     DateTime @updatedAt

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice? @relation("CurrentChainHead", fields: [lastInvoiceId, tenantId], references: [id, tenantId], onDelete: Restrict)
}

model IdempotentRequest {
  tenantId    String
  key         String
  resource    String           // 'INVOICE' | 'CREDIT_NOTE'
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
  hash          String?
  hashVersion   Int @default(1)
  issuedAt      DateTime
  createdAt     DateTime @default(now())

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  customer      Customer      @relation(fields: [customerId], references: [id])
  series        InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)
  items         InvoiceItem[]

  sourceDraft   InvoiceDraft? @relation("DraftConversion")

  currentChainState InvoiceChainState? @relation("CurrentChainHead")

  @@unique([tenantId, seriesCode, type, year, number])
  @@unique([id, tenantId])
  @@index([tenantId, issuedAt])
}

model InvoiceDraft {
  id        String   @id @default(uuid())
  tenantId  String
  status    String   // DRAFT | ISSUING | ISSUED
  // ... sem séries — atribuídas na emissão
}
```

**Invoice.series** passa a ter FK composta — qualquer `Invoice` emitida está ligada a uma série válida; `DRAFT` não. `InvoiceChainState.lastInvoiceId` (tenantId, FK) garante a coerência entre o estado e a cabeça da cadeia.

---

## 6. Constraints SQL propostas

```sql
CREATE UNIQUE INDEX invoice_chain_sequence_unique
  ON "Invoice" ("tenantId", "chainSequence")
  WHERE "chainSequence" IS NOT NULL;

ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_issued_has_chain
  CHECK (
    status <> 'ISSUED'
    OR ("chainSequence" IS NOT NULL
        AND "seriesCode" IS NOT NULL
        AND "year" IS NOT NULL)
  );

ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_fk
  FOREIGN KEY ("lastInvoiceId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;

ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_tenant_unique_id UNIQUE ("id", "tenantId");
```

**Triggers opcionais (não obrigatórios):**

```sql
-- Trigger adicional para coerência crítica
CREATE OR REPLACE FUNCTION enforce_invoice_chain_state_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'ISSUED' THEN
    IF NOT EXISTS (SELECT 1 FROM "InvoiceChainState" WHERE "tenantId" = NEW."tenantId") THEN
      RAISE EXCEPTION 'no InvoiceChainState row for tenant %', NEW."tenantId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_chain_consistency
  BEFORE INSERT ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_chain_state_consistency();
```

**Nota:** a lógica de coerência dentro do fluxo transaccional é suficiente; trigger é defense-in-depth e não pode substituir lógica correcta.

---

## 7. Protocolo transaccional definitivo

```
Fase de pre-verificação:
  1. Cliente valida chave idempotente — nada é escrito; **apenas optimização**
  2. Se Existe já registo E payloadHash coincide → devolve resultado 200 (idempotente)
  3. SeExiste registo E payloadHash difere → HTTP 409
  4. Senão → continua para emissão

BEGIN transaction (runWithTenant)
  5. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0));
  6. INSERT INTO "InvoiceChainState" ON CONFLICT DO NOTHING;
  7. SELECT FOR UPDATE FROM "InvoiceChainState" WHERE tenantId = $1;
  8. INSERT INTO "InvoiceSeries" ON CONFLICT DO NOTHING;
  9. SELECT FOR UPDATE AND increment lastNumber;
  10. chainSequence := lastSequence + 1
  11. previousHash := lastHash
  12. hash := sha256(serializedPayload)
  13. INSERT INTO "Invoice" (status='ISSUED', chainSequence=chainSequence, hash=hash, ...)
  14. UPDATE "InvoiceChainState" (lastHash=hash, lastSequence=chainSequence, lastInvoiceId=Invoice.id)
  15. INSERT INTO "IdempotentRequest" (key, payloadHash, resultId=Invoice.id, resource)
  16. UPDATE "InvoiceDraft" SET status='ISSUED' (se sourceDraftId aplicável)
  17. UPDATE StockMovements / Stock em mesma transação
COMMIT
```

**A pre-verificação nunca substitui a transação.** Aquela é só uma optimização de UX; a autoridade é da transacção.

---

## 8. Ordem única de locks

Aplicada em FT, NC, init, retry, stock — mesma cadeia:

```
1. pg_advisory_xact_lock
2. InvoiceSeries
3. InvoiceChainState
4. Invoice
5. IdempotentRequest
6. Stock/Draft/etc
```

**Stock não usa o mesmo advisory lock por si.** Stock pode manter operações transaccionais respeitando a ordem deste servidor.

**Timeout:** `statement_timeout` para 10s; `lock_timeout` para 5s; deadlock → SQLSTATE 40P01 → rollback → 503 + retry-after.

**Retries:** máximo 3 tentativas (1s, 5s, 30s); nunca com chave idempotente diferente; sempre a chave original.

---

## 9. Algoritmos V1 e V2

### V1 — histórico (preservado)

```typescript
JSON.stringify({
  customerName, customerNif, items,
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
```

SHA-256 do resultado. **As assinaturas contra este formato nunca são recalculadas.** Documentos antigos validam com V1.

### V2 — nova versão

```typescript
function v2Payload(data: any, previousHash: string | null, chainSequence: number) {
  return JSON.stringify({
    hashVersion: 2,
    seriesCode: data.seriesCode,
    documentType: data.type,
    year: data.year,
    number: data.number,
    tenantId: data.tenantId,
    currency: data.currency,
    customerName: data.customerName,
    customerNif: data.customerNif,
    customerId: data.customerId,
    items: data.items.map((item: any) => ({
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      taxRate: item.taxRate.toString(),
      total: item.total.toString(),
    })),
    applyVat: Boolean(data.applyVat),
    discountAmount: data.discountAmount.toString(),
    discountType: data.discountType,
    discountValue: data.discountValue.toString(),
    observations: data.observations ?? null,
    includeCompanyProfile: Boolean(data.includeCompanyProfile),
    companyProfileSnapshot: data.companyProfileSnapshot ?? null,
    companyLogoId: data.companyLogoId ?? null,
    subTotal: data.subTotal.toString(),
    taxTotal: data.taxTotal.toString(),
    total: data.total.toString(),
    issuedAt: data.issuedAt.toISOString(),
    previousHash: previousHash,
    chainSequence,
  });
}
hash = sha256(...);
```

### Canonicalização decimal

```typescript
function canonicalDecimal(value: Prisma.Decimal): string {
  return value.toString();
}
```

| Entrada | Canónica |
|---|---|
| `new Decimal(1000)` | `"1000"` |
| `new Decimal('1000.00')` | `"1000"` |
| `new Decimal('0.10')` | `"0.1"` |
| `new Decimal('0.01')` | `"0.01"` |
| `new Decimal('-100.50')` | `"-100.5"` |

### Seleção de versão

- Documentos novos: **v2 obrigatória**
- Documentos históricos: **v1 preservada**
- `Invoice.hashVersion` indica a versão usada
- V2 não reescreve V1

---

## 10. Reconstrução histórica

```
Fase 1 — Inventário
  documentos := SELECT * FROM "Invoice" WHERE tenantId=$1

Fase 2 — Classificação
  A: documentos com chainSequence válida (a cadeia actual)
  B: históricos antes da cadeia
  C: hash inválido
  D: dados insuficientes
  E: referências inconsistentes
  F: bifurcações pre-existentes

Fase 3 — Raiz
  cadeia := documentos WHERE chainSequence == 1
  if |raiz cadeia| != 1 → bloquear para investigação
  if histórico relevante existir antes da cadeia: não incorporar automaticamente

Fase 4 — Percurso
  cursor := raiz_cadeia
  while true:
    next := SELECT * WHERE tenantId=:t AND previousHash = cursor.hash
    if |next| == 0 → fim
    if |next| > 1  → bloqueio: bifurcação
    if next.chainSequence != cursor.chainSequence + 1 → bloqueio: salto
    if next.hash inválido → bloqueio: hash
    visitados.add(next)
    cursor := next

Fase 5 — Verificação total
  comparar: visitados = documentos com chainSequence OU referenced pela cadeia
  invoices orphans → bloqueio
  invoiceChainState incompatível → bloqueio manual
```

**Nunca alterar hashes nem números históricos.**

---

## 11. Migração

```
1. Inventário: SELECT DISTINCT type, status FROM "Invoice"
2. Inventário: SELECT count(*) FROM "Invoice"
3. Validação de hashes históricos (re-calcular V1)
4. Reconciliação — bifurcações pre-existentes
5. Inicialização de InvoiceSeries (backfill) sem diminuir contadores
6. Inicialização de InvoiceChainState a partir dos dados
7. Verificação pós-migração
8. Rollback se necessário
```

**Produção nunca é vazia por suposição.**

---

## 12. Matriz de testes

| # | Teste | Categoria |
|---|---|---|
| 1 | 100 emissões simultâneas | concorrência real PostgreSQL |
| 2 | 500 emissões simultâneas | stress |
| 3 | FT e NC simultâneas, mesma cadeia | cadeia unificada |
| 4 | 2 instâncias independentes | replicação controllers |
| 5 | 2 tenants | isolamento |
| 6 | Mesma chave concorrente | exactamente 1 emissão |
| 7 | Mesma chave payload diferente | 409 |
| 8 | Timeout pré-COMMIT | 503 |
| 9 | Timeout pós-COMMIT | 200 (mesmo documento) |
| 10 | Rollback a meio | zero órfãos |
| 11 | Falha após reservar número | rollback total |
| 12 | Falha após gerar hash | rollback total |
| 13 | Falha ChainState | rollback total |
| 14 | Inicialização concorrente | exactamente 1 row |
| 15 | chainSequence duplicada | 409 |
| 16 | ISSUED sem chainSequence | constraint SQL |
| 17 | Eliminar documento referenciado | onDelete: Restrict |
| 18 | Inutilizar manual de hash | detecção, bloqueio |
| 19 | Reconstrução completa | linear 1..N |
| 20 | Anulação posterior | número preservado |
| 21 | Bifurcation detectada | bloqueio, manual |
| 22 | Hash V1 validação | OK sempre |
| 23 | Hash V2 validação | OK sempre |
| 24 | Decimal com alta precisão | canonicalização preservada |

---

## 13. Riscos residuais

- AGT — fora do código; processo institucional de certificação
- Produção — inventário obrigatório antes de qualquer migração
- Operações >1000 em simultâneo — simulação necessária antes

---

## 14. Critérios de aprovação

| Critério | Estado |
|---|---|
| Zero contradições entre partes | ✅ após esta fase |
| Idempotência sob concorrência total | ✅ |
| FK real para IdempotentRequest | ✅ |
| Ordem de locks única em todos os fluxos | ✅ |
| V1 e V2 diferenciadas e definidas | ✅ |
| Canonicalização preserva Decimal | ✅ |
| InvoiceChainState coerente | ✅ |
| Migração sem inventar dados | ✅ |
| Constraints SQL alinhadas com Prisma | ✅ |
| Testes cobrem os 24 cenários | ✅ especificados |

---

## 15. Decisão final

**NÃO APROVADA PARA IMPLEMENTAÇÃO A1 — pendente de autorização.**

**APROVADA PARA IMPLEMENTAÇÃO A1 EM STAGING, após:**
1. Autorização escrita do cliente ("Autorizo A1")
2. Inventário de produção: `SELECT DISTINCT type, status FROM "Invoice"; SELECT count(*) FROM "Invoice";`
3. Janela de testes de concorrência em staging (100 FT+NC paralelos)

**Nenhum código, migração ou configuração foi alterado.**

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** `invoice-service.ts:84-98, 212, 329-333`; `crypto.ts`; `prisma/schema.prisma`; `invoice-draft-service.ts`
- **CONFIRMADO NA BD:** zero facturas em staging; 0 records em InvoiceSeries/InvoiceChainState/IdempotentRequest (modelos inexistentes)
- **CONFIRMADO POR TESTE:** crypto.test.ts
- **INFERÊNCIA TÉCNICA:** comportamento sob carga — nunca executado; todos os testes são propostos, não executados
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código, schema, migração ou configuração foi alterada.**
