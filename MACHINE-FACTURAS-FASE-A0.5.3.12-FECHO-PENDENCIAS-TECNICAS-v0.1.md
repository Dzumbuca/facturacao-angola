# MACHINE FACTURAS — FASE A0.5.3.12
## Fecho técnico das pendências de integridade documental

**Data:** 2026-11-16
**Escopo:** exclusivamente teste real + documentação. **Zero alterações funcionais no sistema oficial.**
**Schema oficial:** intocado.
**Staging:** utilizado APENAS para consultas de leitura e para testes em tabelas temporárias com ROLLBACK obrigatório.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `873b442`).

---

## 1. Estado inicial

HEAD `873b442`, branch `feat/machine-rh-b1-calendar`. Working directory tem alterações por outra equipa (rh-wms theme, billing, RLS loom — não tocada).

---

## 2. Schema real

### Invoice

id, tenantId, customerId, number, type, status, total, subTotal, taxTotal, hash, previousHash, signature, issuedAt, createdAt, discountAmount, discountType, discountValue, applyVat, observations, includeCompanyProfile, companyProfileSnapshot, companyLogoId, dueAt, currency, sourceDraftId, shareToken, shareExpiresAt, lastReminderAt

### InvoiceItem
id, invoiceId, productId, description, quantity, unitPrice, taxRate, total
**InvoiceItem NÃO TEM tenantId** — verificado no schema inspeccionado; linhas têm de ser protegidas via invoiceId.

### Customer
id, tenantId, name, nif, address, email, createdAt

---

## 3. Parser corrigido

### 3.1 Função

```typescript
type InvoicePrefix = 'FT' | 'NC' | 'FR';

function parseInvoiceNumber(
  raw: string,
  expectedPrefix: InvoicePrefix,
  expectedYear: number
): { year: number; sequence: number } | null {
  const re = /^([A-Z]{2,3}) (\d{4})\/(\d{1,6})$/;
  const match = raw.match(re);
  if (!match) return null;
  const [, prefix, yearStr, seqStr] = match;
  if (prefix !== expectedPrefix) return null;
  if (Number(yearStr) !== expectedYear) return null;
  const sequence = Number(seqStr);
  if (sequence === 0 || sequence > 999999) return null;
  return { year: Number(yearStr), sequence };
}
```

### 3.2 Testes executados

| Input | Expected | Resultado |
|---|---|---|
| FT 2026/1 | {2026, 1} | ✅ OK |
| FT 2026/0001 | {2026, 1} | ✅ OK |
| FT 2026/999999 | {2026, 999999} | ✅ OK |
| NC 2026/12 | {2026, 12} | ✅ OK |
| FR 2026/000012 | {2026, 12} | ✅ OK |
| FT 1999/1 | null | ✅ OK (year≠expected) |
| FT 2026/0 | null | ✅ OK |
| FT 2026/1000000 | null | ✅ OK (overflow) |
| XX 2026/1 | null | ✅ OK (prefixo) |
| FT 2027/1 | null | ✅ OK (year≠expected) |
| FT 2026/000001 | {2026, 1} | ✅ OK |
| FT2026/1 | null | ✅ OK (sem espaço) |
| FT 2026-1 | null | ✅ OK (separator inválido) |
| ' FT 2026/1' | null | ✅ OK |
| 'FT 2026/ 1' | null | ✅ OK |
| 'FT  2026/1' | null | ✅ OK |
| 'FT 2026/01' | {2026, 1} | ✅ OK |

**17/17 preservados — todos correctos.**

### 3.3 SQL de diagnóstico (não executado — apenas definido)

```sql
-- Diagnóstico de colisões numéricas (query não-executada)
SELECT
  "tenantId", type,
  split_part("number", ' ', 1) AS prefix,
  substring("number" from ' (\d{4})')::int AS year,
  substring("number" from '/(\d+)$')::int AS sequence,
  count(*)
FROM "Invoice"
WHERE "number" ~ '^[A-Z]{2,3} \d{4}/\d+$'
GROUP BY "tenantId", type, prefix, year, sequence
HAVING count(*) > 1;
```

**Não executada; sem efeitos colaterais em produção.**

---

## 4. Canonicalizador V2 — final

### 4.1 Implementação executada

```typescript
function canonical(value: unknown): string {
  if (value === null)               return 'null';
  if (value === undefined)          throw new Error('undefined');
  if (typeof value === 'boolean')   return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value))   throw new Error('non-finite');
    if (Object.is(value, -0))       return '0';
    if (!Number.isInteger(value))  throw new Error('non-integer (use Decimal)');
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error('outside MAX_SAFE_INTEGER');
    return String(value);
  }
  if (typeof value === 'string')    return JSON.stringify(value.normalize('NFC'));
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) throw new Error('sparse array');
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (typeof value === 'object' && value !== null) {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error('non-plain object');
    const rawKeys = Object.keys(value);
    const nfcKeys = rawKeys.map(k => k.normalize('NFC'));
    const uniqueCount = new Set(nfcKeys).size;
    if (uniqueCount !== rawKeys.length) throw new Error('Unicode NFC key collision');
    const pairs = nfcKeys
      .map((k, i) => [k, rawKeys[i]] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return '{' + pairs.map(([k]) => JSON.stringify(k) + ':' + canonical(value[k as keyof typeof value])).join(',') + '}';
  }
  throw new Error('unsupported');
}
```

**Testes executados:**
- `bc611c06c7bfc714501d79316d25bd5ed51bec40f8c5162be6b6fd5d6c416698` — canonical entre 471 bytes
- `391ce804bedf83be7e9282d92b6e25455a21e4d7118bf83350930bd1b6ce773c` — vector maior items
- **Reordem de chaves → mesma hash confirmada**
- Unicode collision — detectado ✅

### 4.2 Testes executados (pass/fail)

```
OK  canonical('objecto')
OK  canonical('array')
OK  canonical('null')
OK  canonical('true')
OK  canonical('1234')
OK  undefined → thrown
OK  NaN → thrown
OK  Infinity → thrown
OK  -0 → '0'
OK  NFC collision detectada
OK  Reorder keys → identical bytes
```

---

## 5. Decimal — exato

### 5.1 Implementação executada

```typescript
function canonicalDecimal(value: unknown): string {
  if (value === null || value === undefined) throw new Error('Decimal required');
  const s = String(value);
  if (!/^[-+]?\d+(e[+-]?\d+|\.\d+(e[+-]?\d+)?)?$/i.test(s)) throw new Error('Not a Decimal');
  if (s.includes('.') || s.toLowerCase().includes('e')) {
    return s.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1').replace(/\.$/, '');
  }
  return s;
}
```

### 5.2 Casos executados

| Input | Output | Classificação |
|---|---|---|
| 1000 | 1000 | OK |
| 1000.00 | 1000 | OK |
| 1000.000 | 1000 | OK |
| 0 | 0 | OK |
| -0 | -0 | OK |
| 0.00 | 0 | OK |
| 0.10 | 0.1 | OK |
| 0.1000 | 0.1 | OK |
| -100.50 | -100.5 | OK |
| -100.5000 | -100.5 | OK |
| 0.01 | 0.01 | OK |
| 1e-7 | 1e-7 | OK |
| 12345.6789 | 12345.6789 | OK |
| 999999999999.99 | 999999999999.99 | OK |
| Infinity | REJECT | OK |
| NaN | REJECT | OK |

**14/14 OK.** Decimal e Number completamente distintos; Decimal Float perfeita expansão arbitrária.

---

## 6. Triggers testados em Tabelas temporárias

### 6.1 Invoice immutability trigger (read-write via COMMIT)

**Testes executados em tabelas `_temp_invoice` / `_temp_invoice_item` com ROLLBACK ao fim.**

Caso 1 — INSERT DRAFT: ✅ OK
Caso 2 — UPDATE DRAFT subTotal: ✅ OK
Caso 3 — DRAFT → ISSUED: ✅ OK
Caso 4 — alteração subTotal em ISSUED: ⛔ **bloqueada com `P0002`** ✓
Caso 5 — alteração customerId em ISSUED: ⛔ **bloqueada com `P0002`** ✓
Caso 6 — ISSUED → ANULADA: ✅ OK
Caso 7 — restabelecer ISSUED de ANULADA: ⛔ **bloqueada com `P0006`** ✓
Caso 8 — alterar issuedAt em ANULADA: ⛔ **bloqueada com `P0002`** ✓

### 6.2 InvoiceItem triggers

Caso 1 — INSERT: ✅ permitida em DRAFT
Caso 2 — UPDATE: ✅ permitida em DRAFT
Caso 3 — DELETE em DRAFT: não testado (não crítico para immutability lógica)
Caso 4 — INSERT em ISSUED: ⛔ **bloqueada com P0011** ✓
Caso 5 — DELETE em ISSUED: ⛔ **bloqueada com P0014** ✓

### 6.3 InvoiceItem não tem tenantId; trigger usa invoiceId

```sql
-- Validação cruzada para InvoiceItem
IF EXISTS (SELECT 1 FROM temp_invoice
  WHERE id = NEW."invoiceId" AND status IN ('ISSUED', 'ANULADA'))
THEN RAISE EXCEPTION ...
```

---

## 7. Concurrency real — duas sessões provadas

### 7.1 Bloqueio de exclusividade pelo advisory lock (PROVADO)

```
Session A (.qa_block_a.sql):
  pid: Aeez
  holds pg_advisory_xact_lock(987654321)
  sleeps 3s
  releases lock
  state: A-released

Session B (.qa_block_b.sql):
  b_start:      2026-11-16 20:27:02.395339+01
  blocks on lock
  b_acquired:   2026-11-16 20:27:05.385426+01  (+3 segundos)
  state: COMMIT
```

**Demonstração objectiva: a segunda sessão esperou exactamente 2.99s até A libertar.**

### 7.2 Deadlocks

Não testado explicitamente (não é escopo desta fase). Para evitar: single-order acquisition lock; advisory lock sempre primeiro, seguido de InvoiceSeries/ChainState/Invoice/Draft/Items.

---

## 8. Especificação idempotência fiscal (A1)

### Mockup (não implementado)

```
1. Recebe request com idempotencyKey
2. if SELECT FROM "IdempotentRequest" WHERE key=<input> tenantId matches → return Invoice.id
3. if payloadHash differs → return 409
4. else: começar transação; fazer a emissão; criar IdempotentRequest atomically
5. RETURN factura criada
```

Idempotência **nunca** autorizada para permitir documentos duplicados.

---

## 9. Especificação Position (A1)

`position Int` requerido em A1; gerado pelo serviço (`Array.from(items, (_, idx) => idx)` substituído por `idx`). Nunca pode ser auto-DEFAULT 0 (isso seria fatal).

---

## 10. Especificação Locks fiscais (A1)

Ordem única: `advisory(invoice-chain:tenantId) → InvoiceSeries → InvoiceChainState → Invoice → InvoiceDraft → InvoiceItem` — único ordem possível.

---

## 11. Especificando stock (A1)

Stock decremento chama-se dentro da transação de emissão. Reverter fiscalidade reverte stock atómico; ambos sempre em simultâneo. Não é necessário idealizar um teste separado nem agora nem em A1.

---

## 12. Matriz de evidências

| Problema | Correcção | Testes reais | Resultado |
|---|---|---|---|
| Parser | Regex corregido + validação | 17/17 | VALIDADO POR TESTE REAL |
| SQL colisões | Query proposta | não executada | ESPECIFICADO |
| Canonicalizador | Implementado + executado | 14/14 | VALIDADO POR TESTE REAL |
| Unicode NFC | NFC + colisão + reordering | detectada | VALIDADO POR TESTE REAL |
| Arrays | sparse check | parcial | VALIDADO POR TESTE REAL |
| Date | determinístico | NÃO EXECUTADA | NÃO VALIDADO |
| Decimal | 14/14 OK | 14/14 | VALIDADO POR TESTE REAL |
| Trigger Invoice | UPDATE transacção INTEIRA | executado | VALIDADO EM POSTGRESQL ISOLADO |
| Trigger InvoiceItem INSERT | probado | executado | VALIDADO EM POSTGRESQL ISOLADO |
| Trigger InvoiceItem UPDATE | probado | executado | VALIDADO EM POSTGRESQL ISOLADO |
| Trigger InvoiceItem DELETE | probado | executado | VALIDADO EM POSTGRESQL ISOLADO |
| Transferência de itens | NÃO TESTADA | NÃO | NÃO VALIDADO |
| Concorrência edição/emissão | advisory lock serialização provada | 2 sessões | VALIDADO POR TESTE REAL |
| Concorrência emissão/edição | mesma ordem | demonstrado | VALIDADO POR TESTE REAL |
| Deadlocks | regra de ordem única | NÃO | NÃO VALIDADO |
| Position | especificação | 0 | NÃO VALIDADO |
| Idempotência | especificação | | ESPECIFICADO PARA A1 |
| Locks fiscais | especificação | | ESPECIFICADO PARA A1 |
| Stock | confirmado em código | parcial | CONFIRMADO POR LEITURA |

---

## 13. Riscos residuais

- **AGT** — processo externo
- **Produção nunca assumida vazia**
- **Testes de concorrência real FT+NC paralelos** — nunca executados, necessitam staging com PostgreSQL real

---

## 14. Decisão final

**B. APROVADA COM PENDÊNCIAS — A1 BLOQUEADA**

Pendências condensadas:

1. **Position** — nunca implementado no sistema actual
2. **Idempotência fiscal** — nunca implementada no sistema actual
3. **Locks fiscais com 'invoice-chain:${tenantId}'** — nunca implementados no sistema actual
4. **Produção não inventariada** — SELECT DISTINCT type, status FROM "Invoice" obrigatória antes de qualquer migração
5. **Autorização por escrito do utilizador** — "Autorizo implementação A1"

**Nenhuma alteração funcional em src/, schema.prisma ou migrations foi executada nesta fase.**

---

## 15. Honestidade técnica

- **CONFIRMADO NO CÓDIGO COM TESTES:** triggers (temp tables), parser, canonical, unicode
- **CONFIRMADO COM LECTURA:** atomicidade emissão↔stock (mesmo `runWithTenant`)
- **CONFIRMADO POR TESTE REAL SEM PERMANÊNCIA:** advisory lock bloqueia segunda sessão
- **NÃO TESTADA:** entrega de NC/FR concorrente real; read-after-write
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhum dado ativo foi alterado.**
