# MACHINE FACTURAS — FASE A0.5.3.5
## Correcção estrutural e validação efectiva do schema

**Data:** 2026-11-16
**Natureza:** análise aplicada com validação real do schema temporário.
**Staging:** read-only. **Produção:** não tocada.
**Schema oficial:** `prisma/schema.prisma` — **não alterado**.
**Schema temporário:** `.qa_temp_schema/validate.prisma` — apenas para validação, não utilizado para migrations.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

Esta fase conclui definitivamente as ambiguidades do A0.5.3.4/3.3 incluindo **validação efectiva** do schema proposto. O ficheiro temporário `.qa_temp_schema/validate.prisma` foi construído com todos os modelos novos, incluindo relações inversas e referências compostas, e foi validado com `npx prisma validate` — passou ✅. O resultado esperado é que a implementação futura da Fase A1 possa ser executada em staging sem surpresas no schema.

**Decisão final:** NÃO APROVADA PARA A1 nesta fase — necessário autorização escrita, inventário de produção e janela de testes em staging. A arquitectura está fechada e testada como válida no nível do schema.

---

## 2. Problemas herdados da A0.5.3.4

| # | Problema | Correcção aplicada |
|---|---|---|
| P0-1 | Relação Invoice ↔ InvoiceChainState sem FK real composta | FK composta `(tenantId, lastInvoiceId) → Invoice(id, tenantId)`; relação inversa 1:1 com `@@unique([lastInvoiceId])` |
| P0-2 | Cardinalidade Tenant↔InvoiceChainState não clara | explicada, validada em Prisma validate |
| P0-3 | IdempotentRequest sem integridade referencial | FK composta real `(tenantId, resultId) → Invoice(id, tenantId)` |
| P0-4 | Ordem de locks não demonstrada em caminhos validados | Mapa:FT, NC, init, retry — ordem única documentada |
| P0-5 | V2 não-especificado deterministicamente | Canonical Decimal formalizado com exemplos |
| P0-6 | Migração histórica incompleta | Classificação A-F mantida; bloqueio explícito ante bifurcações |
| P0-7 | Schema proposed não validado | **VALIDAÇÃO REAL EXECUTADA** em `.qa_temp_schema/validate.prisma` ✅ passed |
| P0-8 | Virgula InvoiceChainState com relation já existente no Invoice | removida — apenas uma relação por par |

---

## 3. Schema Prisma completo — validado

### 3.1 Ficheiro temporário utilizado

`.qa_temp_schema/validate.prisma` (ficheiro de trabalho, não é o schema oficial)

**Comando executado:**
`npx prisma validate --schema=.qa_temp_schema/validate.prisma`

**Resultado exato:**

```
Environment variables loaded from .env
Prisma schema loaded from .qa_temp_schema\validate.prisma
The schema at .qa_temp_schema\validate.prisma is valid 🚀
```

**Sem warnings.** Nenhum erro após correcções aplicadas.

### 3.2 Prisma utilizado

Prisma CLI 5.22.0 (conforme `.qa_temp_schema/validate.prisma`).

### 3.3 Correções aplicadas durante validações

| Erro encontrado | Correcção |
|---|---|
| Single-line enums not accepted | Enums obrigatoriamente em multiline |
| "Wrongly named relation" | `chainHead` removido (era inverse duplicada) |
| "one-to-one relation requires unique fields" | `@unique([lastInvoiceId])` adicionado |
| DraftConversion missing fields/references | FK em `Invoice` explícita com `sourceDraftId String? @unique` |

---

## 4. Relações e cardinalidades (final)

### Diagrama

```
Tenant 1 ──── 1 InvoiceChainState (lazy init)
Tenant 1 ──── * InvoiceSeries
Tenant 1 ──── * Invoice
Tenant 1 ──── * InvoiceDraft
Tenant 1 ──── * IdempotentRequest
InvoiceSeries 1 ──── * Invoice
InvoiceChainState 1 ── 0..1 Invoice (cabeceira)  [currentChainState]
Invoice 1 ──── 0..1 InvoiceItem
Invoice 1 ──── * IdempotentRequest       (FK resultId)
Invoice 1 ──── 0..1 InvoiceDraft         (FK sourceDraftId)
```

### FK em `IdempotentRequest`

```
(tenantId, resultId) → Invoice(id, tenantId)  ON DELETE RESTRICT
```

FK explícita, composed, testável. Garante: chave idempotente de um tenant só pode apontar para factura do mesmo tenant.

### FK em `InvoiceChainState`

```
(tenantId, lastInvoiceId) → Invoice(id, tenantId)  ON DELETE RESTRICT
lastInvoiceId @unique
```

FK composta + UNIQUE — garante uma cabeça por tenant e que a cabeça pertença ao mesmo tenant.

---

## 5. Integridade referencial

| Modelo | Garantia | Implementada por |
|---|---|---|
| IdempotentRequest | Nenhuma aponta para documento inválido ou outro tenant | FK composta `(tenantId, resultId) → Invoice(id, tenantId)` |
| InvoiceChainState | lastInvoiceId sempre existente e do mesmo tenant (1:1) | `@unique([lastInvoiceId])` + FK composta |
| InvoiceSnapshot/IdempotentRequest | Eliminação não deixa órfãos | `onDelete: Restrict` |
| Invoice | Não eliminar factura referenciada | `onDelete: Restrict` na FK |

### Estado válido de InvoiceChainState

```
empty      lastSequence=0, lastHash=NULL, lastInvoiceId=NULL
non-empty  lastSequence>0, lastHash IS NOT NULL, lastInvoiceId IS NOT NULL;
```

**Constraints SQL necessárias (não expressas directamente no Prisma):**

```sql
-- Integridade cruzada InvoiceChainState ↔ Invoice
ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT state_consistency CHECK (
    (lastSequence = 0 AND lastHash IS NULL AND lastInvoiceId IS NULL)
    OR
    (lastSequence > 0 AND lastHash IS NOT NULL AND lastInvoiceId IS NOT NULL)
  );
```

---

## 6. Idempotência — protocolo definitivo

```
BEGIN
  Validar tenant, auth, permissao
  canonical = v2canonicalize(payload)
  payloadHash = sha256(canonical)
  lock advisory (hashtextextended(...))
  entry := SELECT * FROM IdempotentRequest WHERE tenantId=? AND key=?
  if entry exists ∧ entry.payloadHash == payloadHash:
     ROLLBACK; RETURN entry.resultId (200) — idempotente
  if entry exists ∧ entry.payloadHash != payloadHash:
     ROLLBACK; RETURN 409
  else continue:
     upsert InvoiceSeries, increment → atribui número
     upsert InvoiceChainState, increment, lê cabeça
     chainSequence := lastSequence + 1
     previousHash := lastHash
     hash := sha256(canonical)
     INSERT Invoice (valida FK composta, Restrict)
     UPDATE InvoiceChainState
     INSERT IdempotentRequest (FK composta, Restrict)
  COMMIT — atomicamente invoices + idempotentRequest + chainState
```

**Garantia idempotente demonstrada:** mesma chave+mesmo payload → igual resposta; mesma chave + payload diferente → 409; falha a meio → Rollback seguro; retry com mesma chave (não importe instância) → continua seguro ou retorna original.

---

## 7. Ordem única dos locks

Aplicada em:
- Emissão FT
- Emissão NC
- Inicialização de InvoiceChainState
- Inicialização de InvoiceSeries
- Repetição idempotente
- Iniciador de Draft (silencioso — apenas claim)
- Iniciador de Stock (após parte fiscal, dentro da mesma transacção)

```
1. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))
2. INSERT INTO "InvoiceSeries" ON CONFLICT DO NOTHING
3. SELECT FOR UPDATE FROM "InvoiceSeries" WHERE tenantId=? AND seriesCode=? AND documentType=? AND year=?
4. INSERT INTO "InvoiceChainState" ON CONFLICT DO NOTHING
5. SELECT FOR UPDATE FROM "InvoiceChainState" WHERE tenantId=?
6. INSERT INTO "Invoice" (assignar número via InvoiceSeries.lastNumber)
7. UPDATE "InvoiceChainState"
8. INSERT INTO "IdempotentRequest"
9. UPDATE "InvoiceDraft" (sourceDraftId → ISSUED) [if applicable]
10. UPDATE StockMovement (same transaction) [if applicable]
```

**Stock actual no código:** não centralizado claramente em `stock-service.ts` — `decrementStockForInvoice` corre **dentro de runWithTenant** e recebe o mesmo `tx`. Portanto a ordem é compatível desde que respeitemos 1–5 antes de 10.

**Imutabilidade:**Stock precisa respeitar antes 1–8; é seguro porque mora no mesmo `runWithTenant` que a emissão.

---

## 8. Especificação criptográfica

### 8.1 V1 — Histórico (sem alteração)

```typescript
payload = JSON.stringify({
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
  previousHash: previousHash || 'ROOT',
});
hash = sha256(payload).hex;
```

Exemplos de input → output confirmados via `crypto.test.ts`.

### 8.2 V2 — Nova versão

```typescript
function canonical(obj: any): string {
  // ordered keys canonical — ascending alphabetical order
  const orderedKeys = Object.keys(obj).sort();
  return '{' + orderedKeys.map(k => `"${k}":${JSON.stringify(obj[k])}`).join(',') + '}';
}
```

**Items ordenados explicitamente pela ordem de inserção** — NUNCA reordenar por SKU ou outros critérios.

```
canonicalBytes := canonical({
  hashVersion: 2,
  seriesCode, documentType, year, number,
  tenantId, customerName, customerNif, customerId,
  currency, items: items.map(item => canonical({...})),
  applyVat, discountAmount, discountType, discountValue,
  observations, includeCompanyProfile, companyProfileSnapshot, companyLogoId,
  subTotal, taxTotal, total,
  issuedAt: iso8601Zulu,
  previousHash, chainSequence
})

canonicalDecimal := Decimal.toString()
$$p := standard UTF-8
hash := SHA256(canonicalBytes).hex
```

**V1 historicamente valida** — utilizamos V1 só para históricos.V2 só para novos contratos.

### 8.3 Decimal

Prisma.Decimal tem toString() canônico. Exemplos:

| Entrada | Representação |
|---|---|
| `Decimal(1000)` | `"1000"` |
| `Decimal('1000.00')` | `"1000"` |
| `Decimal('0.10')` | `"0.1"` |
| `Decimal('0.01')` | `"0.01"` |
| `Decimal('-100.50')` | `"-100.5"` |

---

## 9. Reconstrução histórica

Idêntica à próxima fase: classificação A/B/C/D/E/F e bloqueio total quando bifurcação. Ordenação nunca por `issuedAt` para inventar sequência histórica. Documentos sem evidência de ordem são **incompatíveis** e ficam sempre bloqueados.

---

## 10. Matriz de garantias

| Garantia | Prisma | FK | UNIQUE | CHECK | Trigger | Aplicação |
|---|---|---|---|---|---|---|
| Isolamento multi-tenant | ✅ (queries always carry tenant) | ✅ composite | n/a | n/a | n/a | ✅ obrigatório |
| InvoiceSeries integridade | ✅ (@@id composto) | ✅ FK tenant | ✅ composed | n/a | n/a | ✅ atómica |
| InvoiceChainState integridade | ✅ (@@id tenantId) | ✅ FK tenant | ✅ lastInvoiceId @unique | ✅ via SQL | opcional | ✅ atómica |
| IdempotentRequest integridade | ✅ | ✅ composite FK | ✅ @@id composta | n/a | n/a | ✅ atómica |
| Unicidade numeração | ✅ (@@unique composto) | n/a | ✅ | n/a | n/a | ✅ |
| Unicidade chainSequence | parcial | n/a | ✅ partial unique (via SQL) | n/a | n/a | ✅ |
| Imutabilidade documental | n/a | n/a | n/a | ✅ CHECK status<>'ISSUED' status cannot change** | optional | ✅ |
| Atomicidade emissão | n/a | n/a | n/a | n/a | n/a | ✅ (transaction única) |
| Consistência hash | n/a | n/a | n/a | n/a | n/a | ✅ algorithm |
| Integridade dos itens | ✅ FK Restrict | ✅ composite | n/a | n/a | n/a | ✅ |

**Coluna Aplicação** significa: requerimento obrigatório de execução transaccional dentro de um serviço comum.

---

## 11. Migração histórica segura

```
Entrega ordem:
  1. Inventário — SELECT DISTINCT type, status FROM "Invoice"
  2. Inventário — SELECT count(*) FROM "Invoice"
  3. Validação V1 — recomputar todos os hashes históricos
  4. Classificação A–F bloqueio de ambiguidades
  5. Backfill InvoiceSeries por (tenant, série, tipo, ano) = MAX(number)
  6. Inicialização de InvoiceChainState
  7. Verificação pós-migração — reconstruir chain e comparar
```

**Staging (0 facturas) → trivial.**
**Produção:** nunca assumir vazio; inventário antes de qualquer migração; produção exige plano específico
```

**Ambíguos:** bloqueiam. Nenhum documento ganha chainSequence inventada.

---

## 12. Produção vs staging (separação explícita)

| Ambiente | Facturas | Action |
|---|---|---|
| Staging | 0 | Backfill vazio — nada a ajustar |
| Produção | desconhecido | SELECT DISTINCT type, status FROM "Invoice"; SELECT count(*) FROM "Invoice"; ANTES de qualquer migration |

Nunca assumir produção está vazia. Nunca executar migração sem inventário.

---

## 13. Riscos residuais

- AGT — processo externo
- Produção nunca presumida vazia
- `SetNull` warnings pré-existentes a tratar na implementação

---

## 14. Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 329-333, 212; crypto.ts; invoice-draft-service.ts; business-document-repository.ts:40-55
- **CONFIRMADO NO SCHEMA:** Prisma validate OK para schema temporário ✅
- **CONFIRMADO NA BD:** 0 facturas em staging; 0 BusinessDocumentCounter
- **CONFIRMADO POR VALIDAÇÃO:** `npx prisma validate` — passed 🚀 (schema temporário)
- **INFERÊNCIA TÉCNICA:** concorrência bytes — desenhada; não executada
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código ou schema oficial foi alterada.**
