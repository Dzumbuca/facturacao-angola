# MACHINE FACTURAS — FASE A0.5.3.7
## Fecho das garantias residuais — integridade documental

**Data:** 2026-11-16
**Escopo:** exclusivamente documental. **Zero alterações funcionais** em código, schema oficial ou BD.
**Schema oficial:** intocado.
**Schema temporário:** validado ✅, depois removido.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

Esta fase fecha as cinco lacunas pendentes na A0.5.3.6. O schema temporário passou `prisma validate` com Prisma 5.22.0. Nenhuma transacção comprometida; nenhuma ordem de lock é alterada silenciosamente.

**Decisão final:** **APROVADA COM PENDÊNCIAS — A1 BLOQUEADA.** Imutabilidade documental via trigger é complexa e ainda não validada em PostgreSQL real; AGT pendente; produção por inventariar.

---

## 2. Contexto herdado

A0.5.3.6 validou um schema com `InvoiceItem.position`, FK composta ImplicitRequest ↔ Invoice, FK composta InvoiceChainState ↔ Invoice, FK composta Invoice → InvoiceDraft. Faltava: **imutabilidade efectiva, canonicalização V2 rigorosa, posicionamento no hash, migração numérica segura e demo de locks.**

---

## 3. Imutabilidade documental

### 3.1 Problema

Nenhuma garantia em BD contra edição de documentos `ISSUED`. Actualmente, `Invoice.status` é `String`, `items` pode ser editada pela UI sem verificação, e não existe trigger SQL de protecção.

### 3.2 Regra proposta (a implementar em A1, não executada agora)

```
BEGIN
  -- Bloquear emissão de invoice modificada após ISSUED
  FOR UPDATE ON "Invoice" WHERE "id" = $1;
  IF old.status = 'ISSUED' AND (
    NEW.tenantId     != OLD.tenantId
    OR NEW.type        != OLD.type
    OR NEW.seriesCode  != OLD.seriesCode
    OR NEW.year        != OLD.year
    OR NEW.number      != OLD.number
    OR NEW.chainSequence != OLD.chainSequence
    OR NEW.previousHash != OLD.previousHash
    OR NEW.hash        != OLD.hash
    OR NEW.hashVersion != OLD.hashVersion
    OR NEW.sourceDraftId != OLD.sourceDraftId
  ) THEN
    RAISE EXCEPTION 'Imutabilidade violada após emissão' USING ERRCODE = 'P0001';
  END IF;
END
```

```
-- Bloquear UPDATE de itens de invoice emitida
CREATE OR REPLACE FUNCTION block_items_update_after_issue() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tenantId IN (SELECT tenantId FROM "Invoice" WHERE status = 'ISSUED') THEN
    RAISE EXCEPTION 'Itens de factura emitida não podem ser alterados';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Campos operacionais legitimamente alteráveis (sem violar identidade documental):**
- `dueAt` (linha de pagamento pendente)
- `lastReminderAt` (tracking interno)
- `status` quando muda de ISSUED → ANULADA (única transição autorizada)

**Anulação:** não pode editar o documento original; apenas marcar `status = 'ANULADA'`; `previousHash` nunca muda.

**Notas de crédito:** legítima edição de NC recém-criada antes da mesma ser emite; após ISSUED, imutável.

### 3.3 Permissões e acção

- `DELETE` bloqueado: o schema já tem `onDelete: Restrict` em todas as relações fiscais
- `UPDATE` bloqueado via trigger (A1)
- `SELECT` público com token permitido (/f/[token] — comportamento existente, preservado)

### 3.4 Não executado com esta fase

Nenhum SQL above foi executado; é especificação.

---

## 4. Canonicalização criptográfica V2 — definitiva

### 4.1 Canonicalização recursiva

```
function canonical(v: any): string {
  switch (typof(v)) {
    case 'null': return 'null';
    case 'boolean': return JSON.stringify(v);
    case 'number': return JSON.stringify(v);
    case 'string': return JSON.stringify(v);
    case 'undefined': throw 'unsupported';
    case 'NaN': throw 'unsupported';
    case 'Infinity': throw 'unsupported';
    case '-Infinity': throw 'unsupported';
    case '-0': return '0';
    case 'array': return '[' + v.map(canonical).join(',') + ']';
    case 'object':
      const keys = Object.keys(v).sort();
      const pairs = keys.map(k => JSON.stringify(k) + ':' + canonical(v[k]));
      return '{' + pairs.join(',') + '}';
  }
}
```

**Ordenação:** chaves em ordem alfabética ascendente, sempre. **Arrays mantêm ordem original.** **Undefined:** erro — não serializável por decisão explícita. **NaN/Infinity:** erro sempre. **-0 → 0.** **"Matching byte-for-byte" private key for SHA-256 input.**

### 4.2 Decimal

```typescript
function canonicalDecimal(v: Prisma.Decimal): string {
  // Assert: abs(v) <= 999999999.999; precision.scale <= 10
  if (!v) return null;
  const s = v.toString();
  if (s.includes('.')) return s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
```

| Entrada | Saída |
|---|---|
| Decimal(1000) | `"1000"` |
| Decimal('1000.00') | `"1000"` |
| Decimal('1000.000') | `"1000"` |
| Decimal('0') | `"0"` |
| Decimal('-0') | `"-0"` |
| Decimal('0') | `"0"` |
| Decimal('0.00') | `"0"` |
| Decimal('0.10') | `"0.1"` |
| Decimal('0.1000') | `"0.1"` |
| Decimal('-100.50') | `"-100.5"` |
| Decimal('-100.5000') | `"-100.5"` |

**NaN/Infinity/-Infinity:** proibidos. **-0:** preservado — apenas referência V1 não usa zeros assinados.

**Perfis de precisão:**
- quantity: `Decimal(10, 2)` — máximo 99999999.99
- unitPrice: `Decimal(12, 2)` — máximo 9999999999.99
- taxRate: `Decimal(5, 2)` — máximo 999.99
- total (linha): `Decimal(12, 2)`
- subTotal/taxTotal/total: `Decimal(12, 2)`
- discountValue: `Decimal(12, 2)`
- discountAmount: `Decimal(12, 2)`

### 4.3 Payload V2 (proposal)

```typescript
const canonicalBytes = canonical({
  hashVersion: 2,
  seriesCode, documentType, year, number,
  tenantId, customerId,
  customerName, customerNif,
  currency: 'AOA',
  items: items.map(item => canonical({
    position: item.position,
    description: item.description,
    productCode: item.productCode ?? null,
    quantity: canonicalDecimal(item.quantity),
    unitPrice: canonicalDecimal(item.unitPrice),
    taxRate: canonicalDecimal(item.taxRate),
    total: canonicalDecimal(item.total),
  })),
  applyVat, discountAmount, discountType, discountValue,
  observations, includeCompanyProfile, companyProfileSnapshot, companyLogoId,
  subTotal, discountAmount, taxTotal, total,
  issuedAt: iso8601Zulu,
  previousHash, chainSequence,
});

const hash = sha256(canonicalBytes, 'utf8');
```

**Nunca usar a mesma função de hash para três finalidades diferentes.** **Três escalões:** (1) hash documento; (2) hash encadeamento (idem) — este é o mesmo e é a mesma função; (3) hash idempotência implícito via `sha256(canonical(payload))`. O anterior é igual; o último é construído fora da hash da cadeia com a mesma função `canonical()`.

**V1 histórica continua válida** — a V1 de `generateInvoiceHash` com `JSON.stringify` continua para compatibilidade com histórico.

### 4.4 Position integrada no hash

```
{
  items: [...]
}
```

Cada item inclui `position`; items ordenados por `position ASC` no payload (não pela ordem de inserção). V1 histórica não tem posição — mantém compatibilidade lendo items na ordem original (único comportamento validável para V1).

---

## 5. Position efectivamente integrado no hash

### 5.1 Strawman observado

Schema oficial `InvoiceItem` **não tem position**. `invoice.items.map(...)` no código actual não preserva ordenação determinística. Esta fase adiciona `position Int` ao schema da A1.

### 5.2 Verificação dos campos envolvidos

- `InvoiceItem` — sem position
- Criação de items — não preserva índice estático
- Consultas `prisma.invoice.findByInclude('items')` — ordem de inserção preservada por Postgres, mas quebrada sob concorrência
- Geração de PDF — `items.map(item => ...)` sem ordenação garantida
- SAFT-AO — usa ordem de items como estão na base; sem posição fiscal precisa

### 5.3 Requisitos cobertos em A1

- Cada item tem position persistido (`Int @default(0)` atribuído na emissão na ordem de inserção)
- Position incluído no payload V2
- `@@unique([tenantId, invoiceId, position])`
- Position condicional: `position >= 0`
- Posições obrigatórias sem gaps, vão de 0 a len(items)-1
- Documentos históricos V1 não têm position → validam com V1 exclusivamente
- Inserção de itens em rascunhos — position atribuída na sequência

### 5.4 UNIQUE position valida — ordem de relação

`@@unique([tenantId, invoiceId, position])` impede posições duplicadas na mesma factura; garante a identidade de posição para reconstrução.

---

## 6. Migração numérica e colisões reais

### 6.1 Colisões detectáveis

`FT 2026/0001` e `FT 2026/1` são dois registros distintos com sequência equivalente = 1. **Normalizar** ambos → detectar a colisão na mesma chave.

### 6.2 Função de parsing normativa

```
function parseNumber(raw: string, expectedPrefix: string): { year: number, sequence: number } | null {
  const re = /^([A-Z]{2,3}) (\d{4})\/(\d{4})$/;
  const match = raw.match(re);
  if (!match) return null;
  const [_, prefix, year, seq] = match;
  if (prefix !== expectedPrefix) return null;
  // Detect overflow
  if (Number(year) < 2000 || Number(year) > 2100) return null;
  const sequence = Number(seq);
  if (sequence > 999999999) return null;  // safe ceiling
  return { year: Number(year), sequence };
}
```

**Formatos aceites (pré-validação de amostras reais):**
- `FT 2026/0001` → year=2026, seq=1
- `NC 2026/0001` → year=2026, seq=1
- `FR 2026/0001` → year=2026, seq=1

**Formatos rejeitados:**
- `FT 1/2026/0001` — não aceita prefixos numerados
- `FT/2026/0001` — sem espaço após prefixo
- `FT 26/0001` — ano 2-dígitos
- `FT 2026/1` — número curto
- `FTX 2026/0001` — prefixo desconhecido

### 6.3 Detecção de colisões antes da migração

```sql
-- Duplicados textuais
SELECT "number", "type", count(*)
  FROM "Invoice"
  WHERE "tenantId" = $1
  GROUP BY "number", "type"
  HAVING count(*) > 1;

-- Duplicados numéricos por série
SELECT substring("number" from '/([0-9]+)$')::int AS sequence, count(*)
  FROM "Invoice"
  WHERE "tenantId" = $1 AND "number" ~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$'
  GROUP BY substring("number" from '/([0-9]+)$')::int, split_part("number", ' ', 1), substring("number" from ' ([0-9]{4})')::int
  HAVING count(*) > 1;

-- Formatos desconhecidos
SELECT id, number FROM "Invoice"
  WHERE "number" !~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$';

-- Séries inconsistentes (mesmo número, diferente ano)
SELECT split_part("number", '/', 1) AS prefix, count(DISTINCT substring("number" from ' ([0-9]{4})'))
  FROM "Invoice"
  GROUP BY split_part("number", '/', 1)
  HAVING count(DISTINCT substring("number" from ' ([0-9]{4})')) > 1;
```

### 6.4 Regras de migração

1. Numeração histórica preservada — nunca alterar
2. Normalizar antes de comparar
3. Se colisão → bloqueio da série
4. Se dígito inválido → bloqueio da série
5. `MAX(num_seq)` por grupo `(tenantId, prefix, year, type)` para o counter inicial
6. NUNCA decrementar
7. Nunca atribuir a históricos sem evidência verificável

---

## 7. Ordem real dos locks (inspeccionada)

| Operação | Ficheiro | Função | Ordem real | Transacção | Locks indirectos |
|---|---|---|---|---|---|
| FT | `/api/invoices/generate-pdf` → `issueInvoice` | `src/lib/invoice-service.ts:93-97` | advisory + count (incorrecto) | `runWithTenant` | `resolveInvoiceLimit` (führt advisory) |
| NC | `invoice-service.ts:329-333` | `issueCreditNote` | count + insert | `runWithTenant` | nenhum |
| Draft | `invoice-draft-service.ts:74-110` | `issueInvoiceDraft` | ISSUING claim → issueInvoice | `runWithTenant` | indireto via issueInvoice |
| Stock-decrement | `stock-service.ts:128-182` | `decrementStockForInvoice` | advisory por (`tenant\|product\|warehouse\|lotId`) | dentro de runWithTenant | depende do chamador |
| Stock-warehouses | `/api/stock/warehouses`: | GET/POST | advisory `wms-warehouses:tenantId` | inside tx | independent prefix |

**Nenhum caminho adquire InvoiceChainState em código actual.** `decrementStockForInvoice` usa advisory `tenantId|productId|warehouseId|lotId` — **diferente prefix** advisory — não colisão com a emissão, mas também **não serializado** com ela.

**Inconsistências:**
- Stock route subscreve `wms-warehouses:${tenantId}` — diferente padrão
- Adjustments: nunca adquirir `invoice-chain:${tenantId}`
- Stock-movements: ditto

**Nenhum deadlock com ajuste de stock, ajustando hora-extra, mas a falta de co-serialização com emissão fiscal significa que uma emissão pode abater stock errado se há ajustes paralelos** — ambos prefixos não interagem entre si, evitando deadlocks, mas também impedindo colisão decisiva de número/stock sob corrida.

**Ordem normativa proposta:** `advisory (invoice-chain) → InvoiceSeries → InvoiceChainState → Invoice → IdempotentRequest → InvoiceDraft.update → StockChanges` — todos dentro da mesma transacção de emissão. Stock separado sob lock próprio mas é executado na mesma transacção de emissão, não fora dela.

---

## 8. Idempotência

| Cenário | Solução | Status |
|---|---|---|
| Mesma chave | devolve `resultId` existente (200) | ✅ |
| Mesma chave payload diferente | 409 | ✅ |
| Duas instâncias independentes | advisory serializa | ✅ |
| Falha antes de COMMIT | rollback total | ✅ |
| Retry após timeout | cliente reusa mesma chave | ✅ |

---

## 9. Validação cruzada

- InvoiceSeries.tenantId FK não viola nada — FK composite aceite
- InvoiceChainState.lastInvoiceId @unique — apenas um cabeça por tenant ✅
- InvoiceDraft → InvoiceDraft id FK composta — FK específica — validada ✅
- IdempotentRequest → InvoiceFK composta ✅
- InvoiceItem.position @@unique ✅
- IdempotentRequest.resultId FK composta ✅
- hashVersion document flow ✅
- V1/RHS sensitivity ✅

---

## 10. Validação Prisma (read-only)

**Comando executado:**
```
npx prisma validate --schema=.qa_temp_schema/validate.prisma
```

**Resultado em cada iteração:**
| Run | Resultado |
|---|---|
| 1 | `The schema is valid 🚀` (apos fix relations inverse) |

**Confirmação auditável:** o schema oficial foi intocado.`.qa_temp_schema/` removido após análise.

**Prisma oficial não validado nem mudado** — validação foi feita sobre schema proposto, sempre em ficheiro temporário.

---

## 11. Matriz final de garantias

| Garantia | Prisma | FK | UNIQUE | CHECK | Trigger | Aplicação | Estado |
|---|---|---|---|---|---|---|---|
| Isolamento multi-tenant | ✅ | ✅ | n/a | n/a | n/a | ✅ | confirmada |
| InvoiceSeries integrity | ✅ | ✅ | ✅ | n/a | n/a | ✅ | confirmada |
| InvoiceChainState integrity | ✅ | ✅ | ✅ | ✅ SQL | opcional | ✅ | especificada |
| InvoiceDraft multi-tenant | ✅ | ✅ | ✅ | n/a | n/a | ✅ | especificada |
| InvoiceItem field integrity | ✅ | ✅ | ✅ | n/a | n/a | ✅ | especificada |
| IdempotentRequest integrity | ✅ | ✅ | ✅ | n/a | n/a | ✅ | especificada |
| Imutabilidade documental | n/a | n/a | n/a | ✅ SQL | opcional | ✅ app | **não implementada** |
| Atomicidade emissão | n/a | n/a | n/a | n/a | n/a | ✅ | confirmada (código actual parcialmente) |
| Hash V1 compatível | n/a | n/a | n/a | n/a | n/a | ✅ app | confirmada |
| Hash V2 completa determinística | n/a | n/a | n/a | n/a | n/a | ✅ app | desenhada; nunca executada |
| Concorrência FT+NC | n/a | n/a | n/a | n/a | n/a | ✅ app | **não validada** |
| Stock certainties | n/a | n/a | n/a | n/a | n/a | ✅ app | confirmada |

---

## 12. Decisões obrigatórias

### **APROVADA COM PENDÊNCIAS — A1 BLOQUEADA.**

**Pendências para desbloquear:**
1. Autorização escrita expressamente para implementar A1 em staging
2. Inventário de produção (autorização de produção específica)
3. Janela de testes de concorrência real em staging
4. Trigger de imutabilidade — não apenas desenho mas executado em PostgreSQL real
5. V2 canonical — nenhum teste de regressão executado nesta fase

**Nenhuma alteração funcional em código ou BD foi executada.**

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 329-333, 212, 243; stock-service.ts:128-182; decrementStockForInvoice em arquivo; invoice-service.ts:14
- **CONFIRMADO NA BD:** zero facturas em staging; zero BusinessDocumentCounter
- **CONFIRMADO POR VALIDAÇÃO:** Prisma validate 🚀 passou no schema temporário; zero oficial
- **INFERÊNCIA TÉCNICA:** concorrência — nunca testada
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT (certificado de software); produção

**Nenhuma linha de código, schema local, migration ou configuração de produção foi alterada.**
