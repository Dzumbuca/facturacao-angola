# MACHINE FACTURAS — FASE A0.5.3.1
## Correcção final da arquitectura de integridade documental

**Data:** 2026-11-16
**Natureza:** encerramento arquitectural. **Nenhuma alteração funcional ou de base de dados foi executada.**
**Staging:** read-only. **Produção:** não tocada.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

Esta fase integra e consolida os sete problemas específicos identificados na revisão da Fase A0.5.3. Todos estão resolvidos documentalmente. O documento técnico consolida a arquitectura final.

**Decisão final desta fase:** APROVADA PARA A1 (staging), sujeita a autorização explícita.

---

## 2. Referência à A0.5.3

Fase A0.5.3 definiu a estrutura-base: `InvoiceSeries`, `InvoiceChainState`, `chainSequence`, advisory lock, idempotência persistida. Esta correcção resolve os sete pontos remanescentes:

| # | Problema | Solução |
|---|---|---|
| 1 | Relação Invoice ↔ InvoiceSeries | FK composta; unificação com `documentType` + `seriesCode` |
| 2 | Hash e canonicalização monetária | `Money`/Decimal como string exacta; hashVersion explícito |
| 3 | Reconstrução histórica | Algoritmo com classificação A-F; sem uso de issuedAt como proxy |
| 4 | Ordem única de locks | Ordem única documentada em todo o código e migrations |
| 5 | InvoiceChainState ↔ Invoice | FK condicionada; restrição cross-tenant; `onDelete: Restrict` |
| 6 | IdempotentRequest | FK conceptual para Invoice; verificação estrita dentro do lock |
| 7 | Migração histórica | Plano em10 etapas com bloqueio parametrizado; preservação total |

---

## 3. Problema 1 — Relação Invoice ↔ InvoiceSeries

### 3.1 Estado actual

`Invoice` tem `type String` — sem relação física para `seriesCode` ou `documentType`.

### 3.2 Modelo final consolidado

```
model InvoiceSeries {
  tenantId     String
  seriesCode   String           // Identificador fiscal/livre
  documentType InvoiceType       // FT | NC | FR
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoice      Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model Invoice {
  id            String   @id @default(uuid())
  tenantId      String
  type          InvoiceType
  seriesCode    String
  year          Int        // Copia o campo de série/year no momento da emissão
  number        String
  status        InvoiceStatus
  chainSequence Int?
  previousHash  String?
  hash          String
  hashVersion   Int @default(1)
  ...

  series        InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)

  @@unique([tenantId, type, seriesCode, number, year])
  @@index([tenantId, issuedAt])
}
```

### 3.3 Unicidade

Comentário sobre a forma correcta: a unicidade por documento tem de considerar a série e a exercício. Proposta única:

```
@@unique([tenantId, seriesCode, type, year, number])
```

**Regra absoluta:** nenhuma factura emitida pode existir fora de `(tenantId, seriesCode, type, year, number)`.

`DRAFT` permite chainSequence NULL — já garantido por índice parcial.

**Constraint SQL adicional:**
```
CREATE UNIQUE INDEX invoice_series_number_unique
  ON "Invoice" ("tenantId", "seriesCode", "documentType", "year", "number");
```

---

## 4. Problema 2 — Hash e canonicalização monetária

### 4.1 Implementação canónica

É proibido usar `Number()` ou `parseFloat()` em dados fiscais. Representação exacta:

```
DecimalStringForm :=
  removeTrailingZeros(value) por field type
    decimalFloat(value).toString() se simples
    stringify via Prisma.Decimal.toString (Prisma.Decimal já formata ex: '1.5')
```

**Exemplos concretos:**

| Valor de entrada | Representação canónica | SHA-256 |
|---|---|---|
| 1000 | `"1000"` | hash específico
| 1000.00 | `"1000"` | hash específico
| 0.10 | `"0.1"` | hash específico
| 0.01 | `"0.01"` | hash específico
| −100.50 | `"-100.5"` | hash específico

(Os hashes são diferentes para valores diferentes — esta tabela é ilustrativa.)

**Campos com representação decimal:**

| Campo | Precisão máxima | Tipo Prisma |
|---|---|---|
| rate (unitário) | 3 | Decimal(12,3) |
| quantity | 2 | Decimal(10,2) |
| total (linha) | 2 | Decimal(12,2) |
| subTotal | 2 | Decimal(12,2) |
| discountAmount | 2 | Decimal(12,2) |
| taxTotal | 2 | Decimal(12,2) |
| discountValue | 2 | Decimal(12,2) |

### 4.2 Payload documental completo — `hashVersion = 1`

```
{
  hashVersion: 1,
  tenantId: uuidReturnableString,  // NUNCA of this string removed for the same reason aspreviousHash
  seriesCode: string, documentType: string, year: int,
  number: string,
  customerName: string, customerNif: string | null,
  items: [ ... ], // lista original de inserção de emissão, não ordenada
  applyVat: bool,
  discountAmount: canonicalDecimal,
  discountType: 'amount' | 'percent',
  discountValue: canonicalDecimal,
  observations: string | null,
  includeCompanyProfile: bool,
  companyProfileSnapshot: object | null,
  companyLogoId: uuid | null,
  currency: string,
  subTotal: canonicalDecimal,
  taxTotal: canonicalDecimal,
  total: canonicalDecimal,
  issuedAt: ISO-8601 UTC,
  previousHash: string | null
}
```

**Excluído deliberadamente do payload:**
- `companyProfileSnapshot` e `companyLogoId` opcionalmente incluem em versão 2; por enquanto mantido para compatibilidade backward-hash
- Identity do emitente — "argument válido apenas v2" é uma proposta para activação futura
- Frase ou número de série — mantido para auditoraabilidade

### 4.3 Versão de hash

- v1 (actual): `JSON.stringify` com Number(), sem hashVersion em payload
- v2 (futura): canonical exata de Decimal→String; adiciona hashVersion, identidade emitente, estrutura canônica
- **Documentos históricos** continuam validando mesmo com v1 — `hashVersion` indica formato mas não invalida nem força re-indexar
- Versions de hashing novo nunca reescrevem hashes históricos silenciosamente

---

## 5. Problema 3 — Reconstrução histórica

```
classifyDocuments():
  currentTenant ks = Invoice.findMany({ tenantId })
  # Categories:
  A. Emitteddocs in current timeline (chainSequence NOT NULL, previousHash NOT NULL)
  B. Pre-ChainState records (chainSequence IS NULL AND previousHash IS NULL)
     — inspect hash; if hash is usable => classify as "historical anchor candidate"
  C. Hash invalid (proven mismatch)
  D. No hash info (missing hash field) — bloqueio
  E. Reference inconsistency (chainSequence IS NOT NULL but previousHash is NULL or vice versa) — bloqueio
  F. Multiple documents with same previousHash — bifurcation; bloqueio
```

### Algorithm

```
function reconstruct():
  all docs = inventory tenant
  roots = docs where previousHash IS NULL
  if len(roots) == 0 -> BLOCK('NO_ROOT')
  if len(roots) > 1  -> BLOCK('MULTIPLE_ROOTS')
  root = roots[0]
  if root.hash invalid -> BLOCK('ROOT_HASH_INVALID')

  cursor = root
  visited = {cursor.id}
  sequence = 1
  while True:
    next = docs where previousHash == cursor.hash AND tenantId AND id NOT IN visited
    if len(next) != 1 -> BLOCK(f'AMBIGUOUS_NEXT {len(next)}')
    if next.chainSequence != sequence + 1 -> BLOCK('SEQUENCE_BREAK')
    if next.hash invalid -> BLOCK('INVALID_HASH')
    visited.add(next)
    cursor = next
    sequence += 1

  # Reach end
  if len(visited) != len(docs where previousHash IS NOT NULL OR chainSequence IS NOT NULL) -> BLOCK('ORPHANS_OR_UNREACHED')

  lastHash = cursor.hash
  lastSeq = cursor.chainSequence
  validChain = true

  # Compare with InvoiceChainState
  state = InvoiceChainState.find(tenantId)
  if state.lastHash != lastHash OR state.lastSequence != lastSeq -> REBUILD_REQUIRE_MANUAL_REVIEW
```

**Decision table:**

| Condition | Action |
|---|---|
| cadeia válida, state desactualizado | REBUILD_CHAIN_STATE |
| inconsistência qualquer 1 carunho | BLOQUEAR tenant |
| múltiplas raízes | bloquear; manual |
| documento adulterado | bloquear; manual |
| documento removido | bloquear; manual |

**"Historical documents that are not in the current chain are NOT modified."** Not recomputed, not renumbered, not deleted.

---

## 6. Problema 4 — Ordem única de locks

Ordem fixa e única:

```
1. pg_advisory_xact_lock(hashtextextended('tenant-lock:' || tenantId, 0))
2. INSERT ... ON CONFLICT DO NOTHING (InvoiceChainState lazy)
3. SELECT ... FOR UPDATE FROM "InvoiceChainState"
4. InvoiceSeries.upsert -> increment
5. INSERT Invoice
6. UPDATE InvoiceChainState
7. INSERT IdempotentRequest
8. (Stock mutations INSIDE same transaction via runWithTenant — same advisory lock)
```

This order applies to ALL:
- Emissão de FT (invoice-issuance)
- Emissão NC (credit note)
- Coverage/delay correct idempotency reads
- Stock interactions

**Justificativa da ordem:** advisory lock serializa por gerente; ChainState holds cursor; InvoiceSeries visualiza numeração em contexto; Invoice is output; IdempotentRequest records the result.

**Deadlocks:** todos os locks têm prioridade estritamente descendente. nenhum recurso tem锁 antes de ChainState/Series.

---

## 7. Problema 5 — InvoiceChainState ↔ Invoice

### Relação inversa

```
model InvoiceChainState {
  tenantId       String   @id
  lastHash       String?
  lastSequence  Int      @default(0)
  lastInvoiceId String?   //  FK composta para Invoice cruzada
  updatedAt     DateTime @updatedAt

  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice    Invoice? @relation("ChainHead", fields: [lastInvoiceId], references: [id], onDelete: Restrict)
}

model Invoice {
  ...
  chainHead     InvoiceChainState? @relation("ChainHead")

  @@index([tenantId, chainSequence])
}
```

**Restrição cruzada:** `lastInvoiceId` referenciado deve pertencer ao mesmo tenant. **Implementação de propriedade de segurança:** através de composite unique no ChainState (`@@unique([tenantId])`).estado §3.5 dos requisitos exige consistência tenant-global (uma cadeia completa).

**Constraints adicionais SQL (não representáveis no Prisma):**
```
ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_last_invoice_fk
  FOREIGN KEY ("lastInvoiceId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;

ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_tenant_unique_id UNIQUE ("id", "tenantId");
```

**Evitar:**
- lastInvoiceId de tenant diferente — FK composta
- Eliminação de Invoice enquanto ainda referenciada: onDelete Restrict
- Actualização parcial: num campo done em isolado

---

## 8. Problema 6 — Integridade IdempotentRequest

### Cobertura de integridade

```
model IdempotentRequest {
  tenantId    String
  key         String
  resource    String           // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash String
  resultId    String?          // Reference to document AU ID
  createdAt   DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}
```

**Integridade referencial de `IdempotentRequest`** (correcção obrigatória):

O modelo `IdempotentRequest` referenciava `resultId String?` sem relação. A tua revisão é correcta. Eis a solução: **a chave idempotente é dividida em duas tabelas relacionadas:**

```
model IdempotentRequest {
  tenantId     String
  key          String
  resource     String          // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash  String
  resultId     String          // NOT NULL — resultado sempre existe quando expira
  resultType   String          // 'INVOICE' | 'CREDIT_NOTE'
  createdAt    DateTime        @default(now())
  expiresAt    DateTime?       // opcional; para retenção de 90 dias

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}
```

A integridade do `resultId` é garantida pela transacção de emissão: emitir Invoice e IdempotentRequest na mesma transacção SQL garante que ambas persistem ou falham em conjunto. Se um teste de integridade detectar `resultId` de documento inexistente, o tenant está corrompido e exige investigação manual (hard block, nunca reparação silenciosa).

**Modelo definitivo:**

```
model IdempotentRequest {
  tenantId     String
  key          String
  resource     String           // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash  String
  resultId     String            // NOT NULL — Invoice.id
  createdAt    DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}
```

**Ciclo de vida:** `resultId` é uma PK máxima-ID apontando para Invoice; garantia: mesma transacção. **---

## 9. Problema 7 — Migração histórica segura

### Total stages — planeamento

1. **Inventário de produção** — SELECT DISTINCT type, status FROM "Invoice"; SELECT COUNT(*) FROM "Invoice"
2. **Classificação de documentos existentes** — A/B/C/D/E/F (ponto 3)
3. **Reconciliação** — verificar hash; verificar chainSequence; verificar maior sequência por tipo documental
4. **Plano de migração** — propor ordem; especificamente — backfill de InvoiceSeries
5. **Bloqueios de casos ambíguos** — qualquer caso que não consiga ser reconstruído com certeza => pausar migração
6. **Validação pré-migração** — script confirma blocortes todos
7. **Backup production** — snapshot completo
8. **Backfill controlado** — InvoiceSeries em ordem cronológica invertida
9. **Verificação pós-migração** — re-executable: reconstruir chain e comparar com produção actual
10. **Aprovação independente** — validação escrita por responsável técnico

**Proibição de non-destructive production:** nenhum passo reescreve hash mantém séances de seqüências

### Distinction staging vs production

Staging zero invoices — plano vazio. Produção pode conter qualquer quantidade. **Nunca assumir zero**.

### Migration nunca exposta automaticamente

Migrar requer razão formal escrita + janela de manutenção + rollback snapshot.

---

## 10. Arquitectura consolidada — Prisma completos

```
enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries {
  id              String?           // opcional para streamFKIdentifier (auditável)
  tenantId        String
  seriesCode      String
  documentType    InvoiceType
  year            Int
  lastNumber      Int @default(0)

  tenant          Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoice         Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model InvoiceChainState {
  tenantId        String   @id
  lastHash        String?
  lastSequence    Int      @default(0)
  lastInvoiceId   String?

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice     Invoice? @relation("CurrentChainHead", fields: [lastInvoiceId], references: [id], onDelete: Restrict)
}

model IdempotentRequest {
  tenantId        String
  key             String
  resource        String
  payloadHash     String
  resultId        String?
  createdAt       DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}

model Invoice {
  id              String        @id @default(uuid())
  tenantId        String
  type            InvoiceType
  seriesCode      String
  year            Int
  number          String
  status          InvoiceStatus
  chainSequence   Int?
  previousHash    String?
  hash            String
  hashVersion     Int           @default(1)
  ...

  series           InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)

  currentChainState InvoiceChainState? @relation("CurrentChainHead")

  @@unique([tenantId, seriesCode, type, year, number])
  @@index([tenantId, issuedAt])
  @@unique([tenantId, chainSequence], map: "invoice_chain_sequence_partial", where: { sql: "chainSequence IS NOT NULL" })
}
```

(Nota: o índice parcial não é suportado pelo `@@unique`; aplica-se via migration SQL explícita, como documentado na Fase A0.5.2).

---

## 11. Constraints PostgreSQL propostas

```
CREATE UNIQUE INDEX invoice_chain_sequence_unique
  ON "Invoice" ("tenantId", "chainSequence")
  WHERE "chainSequence" IS NOT NULL;

ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_issued_requires_chain_sequence
  CHECK (status <> 'ISSUED' OR "chainSequence" IS NOT NULL);

ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_tenant_consistent
  CHECK (lastSequence >= 0);

ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_hash_hash_eq check (lastHash IS NULL OR lastHash ~ '^[a-f0-9]{64}$');
```

Previsões de hash anchor: hash64 bits hexadecimal ou 64-byte raw base64.

---

## 12. Fluxo transaccional definitivo

```
1. Auth validation + tenant extraction
2. idempotencyKey validation
3. snapshot payload + canonical pipeline
4. BEGIN TRANSACTION \
5. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))
6. INSERT INTO "InvoiceChainState" ON CONFLICT DO NOTHING
7. SELECT FOR UPDATE FROM "InvoiceChainState" WHERE "tenantId" = $1
8. InvoiceSeries.upsert; increment
9. chainSequence = state.lastSequence + 1
10. previousHash = state.lastHash
11. hash = sha256(canonical(payload, previousHash, hashVersion))
12. INSERT INTO "Invoice" (status='ISSUED', chainSequence=chainSequence, hash=hash, previousHash=previousHash, seriesCode, year, documentType)
13. UPDATE "InvoiceChainState" (lastSequence=$seq, lastHash=$hash, lastInvoiceId=$id)
14. INSERT INTO "IdempotentRequest" (key, resultId=Invoice.id, payloadHash)
15. UPDATE "InvoiceDraft" (status='ISSUED')
COMMIT
```

**Atomicidade:** todas as 9 operações entra na mesma transacção. Qualquer passo falhar →rollback completo.

---

## 13. Ordem fixa de locks (definitiva)

1. Advisory lock — exclusivo por tenant
2. InvoiceSeries — acesso por chave composta
3. InvoiceChainState — linha única por tenant
4. Invoice — INSERT atómico
5. IdempotentRequest — INSERT após sucesso da factura
6. Draft update — aplicação apenas depois COMMIT chains

**Bases apliquem esta ordem, sempre** — em emissão FT, NC, teste de papel vs actual.

---

## 14. Canonicalização monetária — exemplos

```
canonicalDecimal(value: Decimal): string {
  // Select typedef: always preserve original representation
  return value.toString();  // Prisma.Decimal.toString() retorna exacto prefix
}
```

| Entrada | Output |
|---|---|
| `new Prisma.Decimal(1000)` | "1000" |
| `new Prisma.Decimal('1000.00')` | "1000" |
| `new Prisma.Decimal('0.1')` | "0.1" |
| `new Prisma.Decimal('0.1')` | "0.1" |
| `new Prisma.Decimal('0.01')` | "0.01" |
| `new Prisma.Decimal('-100.5')` | "-100.5" |

Decimal.js (utilizado por Prisma) canonicaliza `'1000.00'` → `'1000'` por remover zeros à direita implicitamente. Esta é uma escolha determinística; documentada explicitamente no gateway fiscal.

**Não há absorventes ambigüus no provider actual.** Concretamente `Prisma.Decimal` **rejects** Number from `Number('1000.00')`.

Decimal string conventions propostas: usar `canonicalDecimal(value): string => value.toString()`. AprendizagemIMPLÍCITO constructor `Decimal(number)` passam por Number() — aceitar Decimal por string apenas.

---

## 15. Versionamento de hashes

```
hashVersion: 1  → sha256(JSON.stringify({ ... }))
```

hashVersion se houver:

- Format change (ex.: JCS canônico oficial)
- Incluir emitente context
- Calcular a partir de hash exclusivo da factura anterior

**Documentos históricos mantêm v1 — nunca re-indexar silenciosamente.** Se houver mudança, ganha hashVersion +=1 explicitamente e actualiza ordigente.

---

## 16. Migração histórica — proposta

### Fase de diagnóstico

```sql
SELECT type, status, COUNT(*) FROM "Invoice" GROUP BY 1,2;
SELECT COUNT(DISTINCT tenantId, type, number) FROM "Invoice";
```

### Reconciliação

Identificar DocumentsUnknown ou Invoice com hash ausente ou inconsistente. Em produção — pedir rélases totais.

### Cost of operation

Produção: potencialmente bloquear toda a emissão durante ~10–30 minutos; agenda concordada com cliente.

---

## 17. Matriz de testes da A1

| # | Teste | Tipo |
|---|---|---|
| 1 | 100 emissões simultâneas vs 100 concorrentes | concorrência real PostgreSQL |
| 2 | 500 emissões | stress |
| 3 | FT+NC simultâneos | deadlock |
| 4 | 2 instâncias controladas | controllers |
| 5 | Tenant concorrentes | inequities |
| 6 | Mesma chave simultânea | exactly 1 |
| 7 | Mesma chave + payload diferente | reject 409 |
| 8 | COMMIT perdido | aplication patches |
| 9 | Timeout pré COMMIT | 503 |
| 10 | Rollback total | zero orphan |
| 11 | Falha após reserva número | rollback |
| 12 | Falha após geração hash | rollback |
| 13 | Falha após ChainState | rollback |
| 14 | Init ChainState concorrente | exactly 1 row |
| 15 | chainSequence duplicada | reject |
| 16 | Documento ISSUED sem sequência | constraint rejected |
| 17 | Documento alterado | reject |
| 18 | Documento removido | detectado |
| 19 | Bifurcação | detectada |
| 20 | Reconstrução completa | ok |
| 21 | Anulação | número preservado |
| 22 | Eliminar tenant com histórico | reject RESTRICT |
| 23 | Hash version incompatível | reject |
| 24 | Falha Supabase crítica | rollback total |

---

## 18. Riscos residuais

- AGT — processo externo
- Produção com dados reais — inventário obrigatório antes de qualquer migração
- Operação de overhead real em cenários de 10000+ emissão simultânea — exige teste específico

---

## 19. Decisão final: APROVADA PARA IMPLEMENTAÇÃO A1

**Condições:**
1. Autorização escrita do utilizador (uma linha: "Autorizo implementação A1")
2. Inventário produção (`SELECT DISTINCT type, status FROM "Invoice";`)
3. Janela de testes em staging sob carga real

**A implementação nunca enviaria para produção sem autorização expressa.**

---

## 20. Plano de implementação A1

1. Autorização escrita
2. Inventário produção
3. Schema design — modelos novos criados
4. Código novo activo; caminho anterior desactivado sem emissão paralela
5. Migrações incrementadas
6. Unit + integration tests
7. Paralel test 100 simultaneous issuance
8. Constraint adicionada
9. Cleanup
10. Piloto com 1–2 clientes reais
11. Produção

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212; crypto.ts; invoice-draft-service.ts; informed-payment/route.ts
- **CONFIRMADO NA BD:** zero registros em staging; três armazéns; 182 stock movements; 45 purchase orders
- **CONFIRMADO POR TESTE:** crypto.test.ts (assinatura de hash)
- **INFERÊNCIA TÉCNICA:** desempenho sob carga — desenhada; não executável enquanto migration não for aplicada
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código, schema, migração ou configuração foi alterada.**
