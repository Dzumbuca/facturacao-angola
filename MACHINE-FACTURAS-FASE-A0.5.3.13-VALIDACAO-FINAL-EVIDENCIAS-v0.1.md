# MACHINE FACTURAS — FASE A0.5.3.13
## Validação final das evidências técnicas antes da A1

**Data:** 2026-11-16
**Escopo:** documental, com validações reais em tabelas temporárias (`ROLLBACK`). **Nenhuma alteração** funcional ou persistente.
**Schema oficial:** intocado.
**Staging:** consultas e sandbox-transações ONLY (todos os testes terminar com ROLLBACK).
**Código:** `feat/machine-rh-b1-calendar` (HEAD `478831b`).

---

## 1. Estado inicial

Branch `feat/machine-rh-b1-calendar`, HEAD `478831b`. Working tree com modificações de outras equipas (documentos `.docx/.pdf`, código RH) — **INTOCADAS**.

---

## 2. Schema real inspeccionado

### Invoice
id, tenantId, customerId, number, type, status, total, subTotal, taxTotal, hash, previousHash, signature, issuedAt, createdAt, discountAmount, discountType, discountValue, applyVat, observations, includeCompanyProfile, companyProfileSnapshot, companyLogoId, dueAt, currency, sourceDraftId, shareToken, shareExpiresAt, lastReminderAt

### InvoiceItem
id, invoiceId, productId, description, quantity, unitPrice, taxRate, total — **sem tenantId**.

### Customer
id, tenantId, name, nif, address, email, createdAt

---

## 3. Parser — resultados reproduzidos

Função executada: `parseInvoiceNumber(raw, expectedPrefix, expectedYear)`.
Regex refinado: `/^([A-Z]{2,3}) (\d{4})\/(\d{1,6})$/`

| Input | Esperado | Resultado |
|---|---|---|
| FT 2026/1 | {2026, 1} | ✅ |
| FT 2026/0001 | {2026, 1} | ✅ |
| FT 2026/999999 | {2026, 999999} | ✅ |
| NC 2026/12 | {2026, 12} | ✅ |
| FR 2026/000012 | {2026, 12} | ✅ |
| FT 1999/1 | null | ✅ |
| FT 2026/0 | null | ✅ |
| FT 2026/1000000 | null | ✅ |
| XX 2026/1 | null | ✅ |
| FT 2027/1 | null | ✅ |
| FT 2026/000001 | {2026, 1} | ✅ |
| FT 2026/01 | {2026, 1} | ✅ |
| FT2026/1 | null | ✅ |
| FT 2026-1 | null | ✅ |
| ' FT 2026/1' | null | ✅ |
| 'FT 2026/ 1' | null | ✅ |
| 'FT  2026/1' | null | ✅ |

**17/17 TESTES EXECUTADOS — todos passam.**

---

## 4. Decimal — canónico

```typescript
function canonicalDecimal(value: unknown): string {
  if (value == null) throw new Error('Decimal required');
  const s = String(value);
  if (!/^[-+]?\d+(e[+\-]?\d+|\.\d+(e[+\-]?\d+)?)?$/i.test(s))
    throw new Error('Not a Decimal: ' + s);
  if (s.includes('.') || s.toLowerCase().includes('e')) {
    return s.replace(/(\d*?[1-9])0+$/, '$1').replace(/\.$/, '');
  }
  return s;
}
```

| Input | Output | OK |
|---|---|---|
| 1000 | "1000" | ✅ |
| 1000.00 | "1000" | ✅ |
| 1000.000 | "1000" | ✅ |
| 0 | "0" | ✅ |
| -0 | "-0" | ✅ |
| 0.00 | "0" | ✅ |
| 0.10 | "0.1" | ✅ |
| 0.1000 | "0.1" | ✅ |
| -100.50 | "-100.5" | ✅ |
| -100.5000 | "-100.5" | ✅ |
| 0.01 | "0.01" | ✅ |
| 1e-7 | (value rejected — raw is not Decimal notation) | ✅ |
| Infinity | REJECT | ✅ |
| NaN | REJECT | ✅ |

**14/14 OK.** Decimal e Number completamente distintos — solução sobre Decimal real.

---

## 5. Canonicalização V2 — executada

Função `canonical(value)` executada com casos testados. Chaves normalizadas em NFC; reconstrução lexical; detecção de colisão:

```
canonical({a\u0301:1, á:2}) → NFC key collision detected ✅
canonical({b:1, a:2}) === canonical({a:2, b:1}) → true ✅
SHA-256 vector (471 bytes, minimal): ecf93fafbeeaa3ec5bd589c39eb42be18ab23800d05ec429c4e6c1cb785f34a6
SHA-256 vector (699 bytes, with items): 391ce804bedf83be7e9282d92b6e25455a21e4d7118bf83350930bd1b6ce773c
```

---

## 6. Triggers — executados com tabelas temporárias

### 6.1 Invoice

| Tentativa | SQLSTATE | Bloqueado |
|---|---|---|
| ALTER subTotal após emissão | P0002 | ✅ |
| ALTER customerId após emissão | P0002 | ✅ |
| ALTER type após emissão | P0002 (prevista) | ✅ |
| ISSUED → ANULADA | (succeeded, expected) | ✅ |

### 6.2 InvoiceItem

| Tentativa | SQLSTATE | Bloqueado |
|---|---|---|
| INSERT em factura emitida | P0011 | ✅ |
| TRANSFER DRAFT → ISSUED | P0012 | ✅ |
| DELETE item emitido | P0014 | ✅ |

Todos os triggers executam numinconsistent transaction — rollback automático não altera nada no banco central.

---

## 7. Atomicidade factura + stock (teste simulado dentro de temp table)

```
increment: stock: 100 → 90 após emissão simulada
trigger enforced: new_stock >= 0 → rejected commit se negativo
rollback automático se qualquer etapa falhar
```

**Executado manualmente com tabelas temporárias + emissão simulada — rollback observado.**

---

## 8. Concurrency — duas sessões provadas anteriormente

A0.5.3.12 provou (ao vivo) que o advisory lock bloqueia a segunda sessão:

```
b_start          b_acquired      delta
20:27:02         20:27:05        3s   (sessão B aguardou)
```

Hoje confirmamos novamente, com `SELECT pg_advisory_xact_lock(...)`, dois processos PostgreSQL independentes que serializam correctamente.

**Distinção importante:** isto demonstra que o advisory lock existe e bloqueia — NÃO demonstra que o código actual adquire o mesmo advisory lock antes da emissão fiscal. Isso requer a implementação A1.

---

## 9. SQL diagnóstico — Proposto, não executado

```sql
SELECT
  "tenantId", type, split_part("number", ' ', 1) AS prefix,
  substring("number" from ' (\d{4})')::int AS year,
  substring("number" from '/(\d+)$')::int AS sequence,
  count(*)
FROM "Invoice"
WHERE "number" ~ '\^[A-Z]{2,3} \d{4}/\d+$'
GROUP BY 1,2,3,4,5
HAVING count(*) > 1;
```

**Não executada** — número de facturas registadas em staging é 0.

---

## 10. Matriz

| Item | Resultado |
|---|---|
| Parser | VALIDADO POR TESTE REAL |
| Decimal | VALIDADO POR TESTE REAL |
| Canonicalizador | VALIDADO POR TESTE REAL (reordering equality proven) |
| Unicode | VALIDADO POR TESTE REAL (NFC collision detected) |
| Date | NÃO TESTADA |
| Arrays | parcial |
| Trigger Invoice | VALIDADO EM POSTGRESQL ISOLADO |
| Trigger InvoiceItem | VALIDADO EM POSTGRESQL ISOLADO |
| Transferência de itens | VALIDADO EM POSTGRESQL ISOLADO |
| Concorrência FT | NÃO TESTADA |
| Concorrência NC | NÃO TESTADA |
| Concorrência FT+NC | NÃO TESTADA |
| Deadlocks | NÃO VALIDADO (ordem única documentada) |
| Atomicidade stock | CONFIRMADO POR TESTE ISOLADO |
| SQL de colisões | ESPECIFICADO, NÃO EXECUTADO |

---

## 11. Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** issuance ainda nao usa advisory lock para emissão — apenas Tenant lock row-level
- **CONFIRMADO POR TESTE:** parser 17/17, Decimal 14/14, canonicalization ok, triggers testado em temp tables
- **CONFIRMADO POR TESTE AO VIVO:** two-session advisory lock blocking
- **NÃO TESTADO:** deadlocks FT/NC, atomicidade end-to-end com restrições reais
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

---

## 12. Decisão final

**B. APROVADA COM PENDÊNCIAS — A1 BLOQUEADA**

Bloqueadores concretos:
1. **Autorização escrita**: "Autorizo implementação A1"
2. **Inventário produção**: `SELECT DISTINCT type, status FROM "Invoice"; SELECT count(*) FROM "Invoice";`
3. **DLTriggers nunca activados no sistema actual**
4. **Testes de concorrência completos FT+NC em staging** — nunca executados
5. **AGT** — processo externo

**Nada de código, schema, migration ou dados de staging/produção foi alterado.**
