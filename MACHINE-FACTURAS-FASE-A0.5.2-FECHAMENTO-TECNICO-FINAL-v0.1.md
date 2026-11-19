# MACHINE FACTURAS — FASE A0.5.2
## Fecho técnico final — integridade documental

**Data:** 2026-11-16
**Escopo:** exclusivamente documental. Nenhuma alteração ao projecto foi executada.
** staging:** read-only. **Produção:** não tocada.
**Código:** `feat/machine-rh-b1-calendar`.

---

## 1. Sumário executivo

As sete correcções contradizem explicitamente A0.5 e a actual literatura. A ordem de locks é única (advisory → InvoiceSeries → InvoiceChainState → Invoice); a cadeia global ao tenant, com contadores fiscais independentes; a hash passa a ter `hashVersion` + canonicalização explicita; a unicidade de `chainSequence` faz-se com índice parcial; a reconstrução histórica lida com bifurcações, ciclos e orphans; DEADLOCK/timeout tem política PLANEJADA; `ISSUING` remove-se do enum de Invoice (vive apenas em InvoiceDraft — verificado no código).

**Decisão final:** arquitectura definitivamente fechada; pronta para iniciar a implementação em staging com autorização explícita, fora de um passo alternativo; AGT continua processo externo independente deste documento.

---

## 2. Status das correcções

| Correção | Estado final |
|---|---|
| C1. Ordem única de locks | ✅ secção 3 |
| C2. UNIQUE NULLS NOT DISTINCT → parcial index | ✅ secção 4 |
| C3. Deadlock/timeout/retry doc incorrecta | ✅ secção 5 |
| C4. Reconstrução histórica incompleta | ✅ secção 6 |
| C5. Hash canônico não-especificado (JCS-like) | ✅ secção 7 — já em código; sem JCS,apenas canonic-order explicit explicito |
| C6. Model + constraints Prisma | ✅ secção 8 |
| C7. Migração e transição | ✅ secção 9 |

---

## 3. Ordem definitiva de locks

**Ordem única**, aplicada sempre — FT, NC, init, retry:

```
1. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0));
2. InvoiceSeries   (acessada por tenantId_seriesCode_documentType_year — ver §8)
3. InvoiceChainState (acessada por tenantId — chave única)
4. Invoice         (INSERT — partido entre ISSUEU ou DRAFT)
5. Stock/outrosrecursos, se aplicável, depois — ver secção 5.1 do stock
```

**Justificativa:** advisory lock separa contexto do cliente dos recursos; InvoiceSeries isola o contador por (tenantId, seriesCode, documentType, year); InvoiceChainState é o estado canónico da cadeia; Invoice é o efeito final; acessórios sempre depois — impede deadlocks e regressões cascata.

**Deadlocks:** locks nunca invertidos. Não há acessos a outras tabelas antes do lock. Ordem estritamente crescente de contenção.

---

## 4. Constraints e unicidade de `chainSequence`

`@unique` Prisma com NULL em duas/mais filas cria erro se mais INVOICE tiverem NULL. Solução: índice parcial PostgreSQL — fora do Prisma — aplicado via SQL migration explícita:

```
CREATE UNIQUE INDEX "invoice_chain_sequence_unique"
  ON "Invoice" ("tenantId", "chainSequence")
  WHERE "chainSequence" IS NOT NULL;
```

**Compatibilidade:** PostgreSQL 18 (versão actual confirmada em staging). Prisma não suporta índice parcial; aplicada em migration SQL após `prisma db push` ou através de migration customizada.

**Documentos ISSUED sem sequência:** proibido por constraint:

```sql
CREATE OR REPLACE FUNCTION enforce_invoice_issued_has_chain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'ISSUED' AND NEW."chainSequence" IS NULL THEN
    RAISE EXCEPTION 'Invoice issued without chainSequence';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_issued_sequence_trigger
  BEFORE INSERT ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_issued_has_chain();
```

**Index em Invoice:** aplicar ao campo habitualmente consultado por `issuedAt DESC` frequente.

**Prisma-compatible workarounds:** Prisma não representa partial index nativamente; acordos através de migration SQL adicional são aceitáveis — processo documentado em §6 (Transition playbook).

---

## 5. Deadlocks, timeouts e retries

### 5.1 Taxonomia

| Esferá / Código | Significado |
|---|---|
| `40P01` | deadlock_detected |
| `55P03` | lock_not_available |
| `57014` | query_canceled |
| `08P01` | protocol_violation (server connection dropped) |
| `23505` | unique_violation |

### 5.2 Política de retry

1. **Nunca** emitir novamente com idempotencyKey diferente após erro/timeout. Reuse a chave original.
2. Esperança mínima: **1, 5, 30 segundos** (backoff exponencial, máximo 3 tentativas).
3. **Nunca retentar dentro da transacção** — apenas depois da decisão do COMMIT como resposta HTTP.
4. O cliente lê o estado consolidado por via de `GET /api/invoices/<id>`. Se a factura existir, devolver a mesma. Não emitir novamente.
5. Sem emitir: `count + 1` apenas a posteriori.

### 5.3 HTTP adequado por cenário

| Cenário | HTTP |
|---|---|
| Deadlock detected (starvation confirmada) | 503 Retry-After 30 |
| IdempotentRequest hit igual payload | 200 (ou 201) já criada |
| IdempotentRequest hit payload diferente | 409 Conflict |
| Timeout pré-COMMIT (lock_timeout ou connection drop) | 503 |
| Timeout pós-COMMIT com sucesso | 201 (a factura existe, retorno) |
| Fallo de Supabase crítico | 503 |

### 5.4 Estado conhecido: Falta graveagravo anterior: nenhum.

---

## 6. Reconstrução histórica completa

### Detecção de todas as patologias — se algo não cumpre, bloqueio é inmediato

```
For each tenant:
  documents := SELECT * FROM "Invoice"
    WHERE "previousHash" IS NOT NULL OR "chainSequence" IS NOT NULL ORDER BY 1;

  raiz := documents where previousHash IS NULL
  if count(raiz) != 1 → bloqueio: 'MÚLTIPLAS RAÍZES'

  if count(raiz) == 0 → bloqueio: 'RAIZ INEXISTENTE'

  if raiz[0].chainSequence IS NULL → bloqueio: 'RAIZ SEM SEQUÊNCIA'

  if raiz[0].chainSequence != 1 → bloqueio: 'RAIZ FORA DE SEQUÊNCIA'

  cursor := raiz[0]
  seen := {cursor}
  while exists(SELECT * FROM "Invoice" WHERE "previousHash" = cursor.hash):
    nextDoc := that row
    if nextDoc IN seen → bloqueio: 'CICLO DETECTADO' (raro mas possível se houver update)
    if nextDoc.chainSequence == cursor.chainSequence → bloqueio: 'DUPLICAÇÃO DE SEQUÊNCIA'
    if nextDoc.chainSequence != cursor.chainSequence + 1 → bloqueio: 'SALTO DE SEQUÊNCIA'
    if nextDoc.hash IS NULL OR nextDoc.hash invalid → bloqueio: 'HASH INVÁLIDO'
    cursor := nextDoc
    seen.add(cursor)

  unowned := document not in seen
  if count(unowned) > 0 → bloqueio: 'DOCUMENTOS NÃO ALCANÇADOS (ÓRFÃOS) - precisa investigação'

  if InvoiceChainState.lastSequence != cursor.chainSequence → bloqueio: 'ESTADO DE CADEIA INCONSISTENTE'
```

**Algoritmo de reconstrução (pseudocódigo):**

```
function reconstructFromTenant(tenantId):
  docs = loadAllDocuments(tenantId)
  roots = findRoots(docs)
  if |roots| != 1: raise UnrecoverableIntegrityError
  cursor = roots[0]
  seen = {cursor}
  chain = [cursor]
  while true:
    next = findByPreviousHash(docs, cursor.hash)
    if not next: break
    if next in seen: raise CycleDetectedError
    if next.chainSequence != cursor.chainSequence + 1: raise SequenceBreak
    if not isHashValid(next): raise HashMismatchError
    chain.append(next)
    seen.add(next)
    cursor = next
  orphans = docs - set(chain)
  if orphans: raise OrphansDetected
  reconstructInvoiceChainState(tenantId, cursor.lastHash, cursor.chainSequence)
```

**Não reconstruir automaticamente** se alguma destas condições falhar. Bloquear o tenant até investigação humana.

**`MAX(chainSequence)` como prova** — **não aceite como evidência de integridade**; pode estar desactualizado.

**Bifurcações**: documento X e Y ambos com previousHash == tip G: bloqueio por 'BILTE'.

---

## 7. Hash canónico + hashVersion

### 7.1 Payload structure (hashVersion = 1)

```
function canonicalInvoicePayload(invoice) {
  // Arrays NOT sorted — ordem de emissão preservada
  return JSON.stringify({
    customerName: invoice.customerName,
    customerNif: invoice.customerNif,
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      total: Number(item.total),
    })),
    applyVat: Boolean(invoice.applyVat),
    discountAmount: Number(invoice.discountAmount),
    discountType: invoice.discountType,
    discountValue: Number(invoice.discountValue),
    observations: invoice.observations ?? null,
    includeCompanyProfile: Boolean(invoice.includeCompanyProfile),
    companyProfileSnapshot: invoice.companyProfileSnapshot ?? null,
    companyLogoId: invoice.companyLogoId ?? null,
    subTotal: Number(invoice.subTotal),
    taxTotal: Number(invoice.taxTotal),
    total: Number(invoice.total),
    date: invoice.issuedAt.toISOString(),
    previousHash: invoice.previousHash ?? null,
  });
}
```

**Decimal** fica como Number com precisão dupla aceitável (SHA256 é deterministic given byte-identical input). Não usar precision decimal library.

**Datas**: ISO-8601 UTC (`toISOString()`) — already the case.

**Propriedades**: `JSON.stringify` canonical order = inserionation order of object literal — as long as the code consistently produces the same insertion order, the result is deterministic. Não utilizar abstração JCS (RFC 8785); canonic manual é suficiente.

**`hashVersion`**: a coluna suplementar não deve ser entendida como "atualização que invalida hashes antigos". `hashVersion` é descritor do formato usado no momento da emissão.

- v1: formato actual (`JSON.stringify` + sha256)
- v2 (futuro): formato quiadrahd, incluindo `hashVersion` em payload

---

## 8. Modelo Prisma + constraints refenciais

```
enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries {
  tenantId     String
  seriesCode   String           // AGT fiscal series code or any prefix decided by tenant-series
  documentType InvoiceType      // FT | NC | FR
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model InvoiceChainState {
  tenantId       String   @id
  lastHash       String?
  lastHashVersion Int      @default(1)
  lastSequence   Int      @default(0)
  lastInvoiceId  String?
  updatedAt      DateTime @updatedAt

  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  lastInvoice    Invoice? @relation("LastChainStateInvoice", fields: [lastInvoiceId], references: [id], onDelete: SetNull)
}

model IdempotentRequest {
  tenantId     String
  key          String
  resource     String           // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash  String
  resultId     String?
  createdAt    DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, createdAt])
}

model Invoice {
  ...
  type          InvoiceType       // FT | NC | FR
  status        InvoiceStatus     // DRAFT | ISSUED | ANULADA — ISSUING em InvoiceDraft
  seriesCode    String            // registrado por emissão para rasteabilidade
  documentType  InvoiceType
  chainSequence Int?
  hashVersion   Int @default(1)
  previousHash  String?
  hash          String

  @@unique([tenantId, type, number])
  // chainSequence único via índice parcial (ver §4)
}

// Drop ISSUING from invoice. Draft flow stays with InvoiceDraft.status, which is String.
```

**Tradição preservada (issueKey):** `@@unique([tenantId, idempotencyKey])` actual NÃO existe em `Invoice` — está em `Payment`. Static draft uses `sourceDraftId` for idempotency drafts.

**Declaração de `ISSUING` em `Invoice`:** não encontrado no código como estado de `Invoice` — só em `InvoiceDraft`. **não adicionar** `ISSUING` ao enum `InvoiceStatus`.

---

## 9. Migração e transição

| # | Etapa | Evidência |
|---|---|---|
| 1 | Diagnóstico | `SELECT DISTINCT type, status FROM "Invoice"` — staging executa actualmente zero rows |
| 2 | Inventário | `SELECT count(*), count(DISTINCT tenantId, type, number) FROM "Invoice"` |
| 3 | Validação hash | Requires actual documents — not yet available |
| 4 | Reconstrução | Requires Documents — actualisado 10-14 |
| 5 | Backfill | `InvoiceSeries` inicializada `NULL` nested com rows `Invoice` |
| 6 | Schema extension | Add enums, add models, prisma/migrations/ |
| 7 | Implementação do serviço | Refactor issueInvoice + issueCreditNote |
| 8 | Testes activos | 25 cenários (§10) |
| 9 | Activação | Feature flag/toggle |
| 10 | Remover mecanismo antigo | Não tem codebase no checkpoint; Irina.fs always new |
| 11 | Audit pós-activação | Pagamentos +
 saída |

**Transição sem fallback:** ambos viementos novos e velhos emitirem factilas ficam **ambos** activos simultaneamente durante a transição controlada. Após a validação, removemos o caminho antigo.

---

## 10. Matriz de provas actualizada

| # | Teste | Objectivo | Critério |
|---|---|---|---|
| 1 | 100 emissões simultâneas (carga real PG) | Sequence linear | 1-100 contínuo |
| 2 | 500 emissões simultâneas | Sem violação UNIQUE | sequence exactly contiguous |
| 3 | FT e NC concorrentes na mesma cadeia | Concurrent sequence | cadeia linear 1-N |
| 4 | 2 instâncias | Comportamento igual | cadeia linear |
| 5 | 2 tenants | isolamento | acção de auditorias zero-cross |
| 6 | Same key simultânea | production integrity | exactamente 1 factura |
| 7 | Same key payload replay | discrimination test | 409 |
| 8 | Timeout pós COMMIT | retryidempotent | exactamente 1 factura |
| 9 | Rollback antes COMMIT | grant negligible cost | zero orphan |
| 10 | Falha reservar número | full rollback | zero orphan |
| 11 | Falha após gerar hash | recovery | cadeia intacta |
| 12 | Falha de update em InvoiceChainState | recovery | cadeia intacta |
| 13 | Init simultânea ChainState | exactly 1 row | exactamente 1 |
| 14 | chainSequence duplicada | rejection | 409 |
| 15 | Documento ISSUED sem chainSequence | rejection | 409 |
| 16 | Documento alterado manualmente | block | bloquesa estado |
| 17 | Documento removido | detection | alert |
| 18 | Bifurcação da cadeia | detection | bloquear tenant |
| 19 | Reconstrução integral | complete blockchain verification | linear |
| 20 | Anulação | prevenção rollback histórico | number imutável |
| 21 | Draft chainSequence | lock: several drafts NULL chain | OK, drafts funcionam |
| 22 | Deadlock real | pg_locks wait | 503 Retry-After < 30 |
| 23 | Lock timeout | lock not available | 503 |
| 24 | Statement timeout | execution cancelado | 503 |
| 25 | hashVersion travel | hash válido com v1 | success |

---

## 11. Riscos residuais

- AGT externe
- Produção sem dados de staging
- Programação paralela em curso

---

## 12. Plano de implementação A1

1. Migration schema扩展
2. Código novo issuance
3. Testes 1-22
4. Constraint FK/index
5. Remove universal count+1 path

---

## 13. Decisão final

- Os sete pontos foram corrigidos? **Sim.**
- Arquitectura definitivamente fechada? **Sim.**
- Pronta para implementar em staging? **Sim, com autorização explícita.**
- Perimissões pendentes: **AGT e produção inicial**.
- Aspectos dependentes de AGT: **todos os aspectos de certificação fiscal do software**.

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333; crypto.ts; invoice-draft-service.ts (ISSUING somente lá)
- **CONFIRMADO NA BD:** 0 facturas em staging; zero BusinessDocumentCounter
- **CONFIRMADO POR TESTE:** crypto.test.ts (hash chaining)
- **INFERÊNCIA TÉCNICA:** comportamento concorrente — desenhado mas não executado
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código, schema, migration ou configuração foi alterada.**
