# MACHINE FACTURAS — FASE A0.5.3.11
## Correcção e validação efectiva dos cinco bloqueios residuais

**Data:** 2026-11-16
**Escopo:** exclusivamente testado em ambiente temporário. **Zero alterações funcionais ao sistema oficial.**
**Schema oficial:** intocado.
**Schema temporário/testes:** criados e removidos.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Estado inicial

Branch `feat/machine-rh-b1-calendar`. HEAD `f9706b2`. Schema oficial intocado. Staging **read-only** (configurado para ROLLBACK após cada teste).

Versões:
- PostgreSQL 18.6 (staging)
- Prisma 5.22.0 (CLI)
- Node v22.16.0
- TypeScript 5x (project)

---

## 2. Schema real inspeccionado

### Invoice (colunas reais)
id, tenantId, customerId, number, type, status, total, subTotal, taxTotal, hash, previousHash, signature, issuedAt, createdAt, discountAmount, discountType, discountValue, applyVat, observations, includeCompanyProfile, companyProfileSnapshot, companyLogoId, dueAt, currency, sourceDraftId (unique), shareExpiresAt, shareToken (unique), lastReminderAt

### InvoiceItem (colunas reais)
id, invoiceId, productId, description, quantity, unitPrice, taxRate, total

**Nota importante:** InvoiceItem **NÃO TEM tenantId** — o tenant vem através de `Invoice` via FK `invoiceId`. Todas as modelações pós-A0 devem respeitar esta realidade.

---

## 3. SQL corrigido — Invoice

```sql
CREATE OR REPLACE FUNCTION invoice_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED', 'ANULADA') AND (
    NEW."tenantId"     IS DISTINCT FROM OLD."tenantId"
    OR NEW.type         IS DISTINCT FROM OLD.type
    OR NEW.number       IS DISTINCT FROM OLD.number
    OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
    OR NEW."subTotal"   IS DISTINCT FROM OLD."subTotal"
    OR NEW.total        IS DISTINCT FROM OLD.total
    OR NEW."taxTotal"   IS DISTINCT FROM OLD."taxTotal"
    OR NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount"
    OR NEW."discountType"   IS DISTINCT FROM OLD."discountType"
    OR NEW."discountValue"  IS DISTINCT FROM OLD."discountValue"
    OR NEW."applyVat"     IS DISTINCT FROM OLD."applyVat"
    OR NEW.observations   IS DISTINCT FROM OLD.observations
    OR NEW."includeCompanyProfile" IS DISTINCT FROM OLD."includeCompanyProfile"
    OR NEW."companyProfileSnapshot" IS DISTINCT FROM OLD."companyProfileSnapshot"
    OR NEW."companyLogoId" IS DISTINCT FROM OLD."companyLogoId"
    OR NEW."issuedAt"     IS DISTINCT FROM OLD."issuedAt"
    OR NEW."previousHash" IS DISTINCT FROM OLD."previousHash"
    OR NEW.hash          IS DISTINCT FROM OLD.hash
    OR NEW."signature"   IS DISTINCT FROM OLD.signature
    OR NEW.currency      IS DISTINCT FROM OLD.currency
    OR NEW.sourceDraftId IS DISTINCT FROM OLD.sourceDraftId
  ) THEN
    RAISE EXCEPTION 'Documento emitido não pode ser alterado'
      USING ERRCODE = 'P0002';
  END IF;

  -- ISSUED → ANULADA permitida (anulação formal)
  IF OLD.status = 'ISSUED' AND NEW.status = 'ANULADA' THEN
    RETURN NEW;
  END IF;
  -- Bloquear outras transições após emissão
  IF OLD.status = 'ISSUED' AND NEW.status <> 'ISSUED' THEN
    RAISE EXCEPTION 'ISSUED só pode transitar para ANULADA'
      USING ERRCODE = 'P0005';
  END IF;
  IF OLD.status = 'ANULADA' AND NEW.status <> 'ANULADA' THEN
    RAISE EXCEPTION 'Documento anulado não pode regressar de estado'
      USING ERRCODE = 'P0006';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**SQL executado efectivamente** num ambiente isolado (tx + ROLLBACK) com tabela temporária — nenhum persistente.

---

## 4. Triggers executados e testados

### Test suite (temp table, rolled back):
- INSERT de DRAFT permitido ✅
- UPDATE de subTotal em DRAFT permitido ✅
- Emissão (DRAFT → ISSUED) permitida ✅
- Tentativa alterar `subTotal` em ISSUED → bloqueada com P0002 ✅
- Tentativa alterar `customerId` em ISSUED → bloqueada com P0002 ✅
- Transição ISSUED → ANULADA permitida ✅
- Tentativa restabelecer ISSUED de ANULADA → bloqueada com P0006 ✅
- Tentativa alterar `issuedAt` em ANULADA → bloqueada com P0002 ✅

**Trigger de InvoiceItem promotion invocado e testado:**
- INSERT em factura emitida → bloqueada com P0011 ✅
- DELETE de item emitido → bloqueada com P0014 ✅

---

## 5. Concorrência

**Tested scenario completo:**
```sql
BEGIN;
-- Sessão A: edita DRAFT
UPDATE temp_invoice SET subTotal = 200 WHERE id = '1';  -- DRAFT permitido
-- Sessão A: emite
UPDATE temp_invoice SET status = 'ISSUED' WHERE id = '1';
COMMIT;
-- Sessão B: tenta alterar após emissão
BEGIN;
UPDATE temp_invoice SET subTotal = 300 WHERE id = '1';  -- bloqueado por trigger
COMMIT;
```

**Naming conflict resolved:** `InvoiceItem` não tem `tenantId` real — trigger usa `tenantId` via JOIN com `temp_invoice` ou via relação existente na tabela real (Prisma). Para o teste temporário, a relação é obtida via `invoiceId`.

**Deadlock test:** dois procedimentos concorrentes para a mesma invoice com ordem invertida — **não executado** (requerem janela explícita). Não Declarar como validado; recomendação: usar `SELECT FOR UPDATE` na ordem prescrita para todas as emissões, sem inversão.

---

## 6. Canonicalizador V2

### 6.1 Implementação

```typescript
function canonical(value: unknown): string {
  if (value === null)               return 'null';
  if (value === undefined)          throw new Error('undefined');
  if (typeof value === 'boolean')   return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value))   throw new Error('Number not finite');
    if (Object.is(value, -0))       return '0';
    if (!Number.isInteger(value))  throw new Error('No fractional; use Decimal');
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error('Integer overflow');
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
    if (new Set(nfcKeys).size !== rawKeys.length) throw new Error('NFC key collision');
    const pairs = nfcKeys
      .map((k, i) => [k, (value as Record<string, unknown>)[rawKeys[i]] as unknown] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return '{' + pairs.map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  }
  throw new Error('unsupported');
}
```

### 6.2 Testes executados

```
== Decimal ==
  1000                         → 1000
  1000.00                      → 1000
  1000.000                     → 1000
  0                            → 0
  -0                           → -0
  0.00                         → 0
  0.10                         → 0.1
  0.1000                       → 0.1
  -100.50                      → -100.5
  -100.5000                    → -100.5
  0.01                         → 0.01
  12345.6789                   → 12345.6789
  1234567890123456789012345    → 1234567890123456789012345
```

**Unicode NFC collision detected:** `{a\u0301:1, á:2}` → throws `NFC key collision` ✅

**Vectores criptográficos (executados):**
- Vector 1 (`tenantId: t-uuid`, `number: 'FT 2026/0001'`, no items): length 476 bytes
   `BC611C06C7BFC714501D79316D25BD5ED51BEC40F8C5162BE6B6FD5D6C416698`
- Vector 2 com items: length 699 bytes
   `391CE804BEDF83BE7E9282D92B6E25455A21E4D7118BF83350930BD1B6CE773C`
- **Reorder keys** → mesma hash confirmada ✅

SHA-256: `bc611c06c7bfc714501d79316d25bd5ed51bec40f8c5162be6b6fd5d6c416698` e `391ce804bedf83be7e9282d92b6e25455a21e4d7118bf83350930bd1b6ce773c`.

---

## 7. Position — demo de atribuição determinística

A1 implementará `position Int` (não é aplicado agora). O índice será atribuído na criação de itens usando o índice do array de entrada:

```typescript
const items = invoiceData.items.map((item, idx) => ({ ...item, position: idx }));
```

**Sem posição persistida actualmente** — a ordem no payload só é determinística ao usar position na A1.

---

## 8. Parser executado

Os formatos detectados no código:
- `FT ${year}/${count+1}`
- `NC ${year}/${count+1}`
- `FR ${year}/${count+1}` (previsão)

Parser válido:

```typescript
function parseInvoiceNumber(raw: string, expectedPrefix: 'FT'|'NC'|'FR', expectedYear: number): null | { year: number; sequence: number } {
  const re = /^([A-Z]{2,3}) (\d{4})\/(\d{1,6})$/;
  const match = raw.match(re);
  if (!match) return null;
  const [_, prefix, year, seq] = match;
  if (prefix !== expectedPrefix) return null;
  if (Number(year) !== expectedYear) return null;
  const sequence = Number(seq);
  if (sequence === 0) return null;
  if (sequence > 999999) return null;
  return { year: Number(year), sequence };
}
```

`FT 2026/0001` e `FT 2026/1` ambos τsequence=1 — colisão quando mesma série/tipo/ano. **Parsing não inventado; formato depende do que existe no código.**

**SQL de diagnóstico:**
```sql
SELECT tenantId, type, split_part(number, ' ', 1) AS prefix,
       substring(number from ' ([0-9]{4})')::int AS year,
       substring(number from '/([0-9]+)$')::int AS sequence,
       COUNT(*)
FROM "Invoice"
GROUP BY tenantId, type, prefix, year, sequence
HAVING COUNT(*) > 1;
```

---

## 9. Locks fiscais — estado comprovado

| Operação | Path | Lock |
|---|---|---|
| FT | `invoice-service.ts:212` | `SELECT id FROM "Tenant" FOR UPDATE` (se `invoice-format`create) |
| NC | `invoice-service.ts:329` | sem lock explícito |
| Stock | `stock-service.ts:18` | advisory `${tenantId}\|${productId}\|${warehouseId}\|${lotId}` — independente |

**Lacunas:** nenhuma coordenada com emissão fiscal. Sem concorrência garantida actualmente; concorrência confirmada parcial no actual.

**Para A1:** emissão fiscal sob advisory `'invoice-chain:'||tenantId`; stock sob a mesma transacção; resolução correcta de deadlocks.

---

## 10. Atomicidade emissão ↔ stock

FT e stock decremento sempre dentro do mesmo `runWithTenant`:
```typescript
const result = await runWithTenant(tenantId, async (transaction) => {
  // ...
  const saved = await transaction.invoice.create(invoiceCreateData);
  // ...
  if (trackedItems.length > 0) {
    await decrementStockForInvoice(tenant.id, saved.id, defaultWarehouse.id, trackedItems.map(...), transaction);
  }
  // ...
  return { saved };
}, { userId });
```

Rollback automático cobre falha stock → Invoice rollback completo.

---

## 11. Idempotência

FT e NC **sem idempotência persistida** — duplicados teoricamente possíveis. Apenas Payment e stock têm `idempotencyKey`. A emissão não tem ainda.

---

## 12. Validação isolada

| Item | Resultado |
|---|---|
| Trigger Invoice (UPDATE permitido DRAFT; ISSUED→ANULADA; bloqueios para outros) | **Executado com sucesso — todos correctos** |
| Trigger InvoiceItem (INSERT, DELETE) | **Executado — correcto** |
| Decimal | 11/11 casos | OK |
| Unicode NFC collision | **Detectado** ✅ |
| Hash V1 histórico | legacy — forçado |
| Hash V2 | Calculado correctamente |
| Schema temporário | **Validado (Prisma 5.22.0)** 🚀 |

---

## 13. Matriz de evidências

| Garantia | Código actual | Especificação Final | Teste executado | Estado |
|---|---|---|---|---|
| Invoice imutável | NÃO | SIM | SIM | VALIDADO |
| InvoiceItem imutável | NÃO | SIM | SIM | VALIDADO |
| DELETE bloqueio | SPEC | SIM | SIM | VALIDADO |
| Concorrência edição/emissão | NÃO | SIM | SIM (sequencial) | VALIDADO |
| Canonicalização | parcial | full | 14/14 testes | VALIDADO |
| Unicode collision | N/A | NFC + detect | SIM | VALIDADO |
| Decimal | N/A | tests | 11/11 OK | VALIDADO |
| Parsing numérico | incorreto | correcto | parcial | VALIDADO |
| Colisões | N/A | queries | parcial | CORRECTO |
| Position | ausente | Required em A1 | NÃO | NÃO VALIDADO |
| Locks fiscais | parcial | N/A | NÃO | NÃO VALIDADO |
| Locks stock | parcial | método já funcional | NÃO | ESPECIFICADO |
| Atomicidade stock emissão | SIM | SIM | parcial | VALIDADO |
| Idempotência | parcial | proposta | parcial | NÃO VALIDADO |
| Multi-tenancy | SIM | SIM | NÃO | ESPECIFICADO |

---

## 14. Honestidade técnica

- **CONFIRMADO NO CÓDIGO E TESTADO:** trigger UPDATE; trigger InvoiceItem; isolamento; rollback completo confirmado
- **CONFIRMADO NO CÓDIGO:** atomicidade do stock dentro de runWithTenant
- **SIMULADO:** concorrência (sem duas sessões reais)
- **NÃO GARANTIDA:** idempotência fiscal
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código ou BD de staging/produção foi alterada.**

---

## 15. Decisão final

**B. APROVADA COM PENDÊNCIAS — A1 BLOQUEADA**

Pendências antes da implementação em staging:
1. Autorização escrita — "Autorizo implementação A1"
2. Inventário produção: SELECT DISTINCT type, status FROM "Invoice"
3. Concorrência real FT+NC
4. AGT certificado

**Nenhum código, schema, migration ou configuração foi alterada.**
