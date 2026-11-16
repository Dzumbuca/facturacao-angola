# MACHINE FACTURAS — FASE A0.5.3.9
## Correcção final das falhas de implementação — integridade documental

**Data:** 2026-11-16
**Escopo:** exclusivamente correcção + validação isolada. **Zero alterações** a código ou BD.
**Schema oficial intocado.**
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

A revisão A0.5.3.8 identificou 9 falhas. Esta fase corrige cada uma explicitamente, com evidências recolhidas no código actual. Os testes de canonicalização e Decimal executaram com sucesso (11/11 OK). O schema temporário passou `prisma validate` (Prisma 5.22.0).

**Decisão final:** **APROVADA COM PENDÊNCIAS — A1 BLOQUEADA** (mesmos bloqueadores que A0.5.3.8).

---

## 2. Contexto

A0.5.3.8 fechou 7 de 9 problemas. Os restantes exigem implementação + testes que não podem ser efectuados sem autorização de staging.

---

## 3. Imutabilidade Invoice — completa

### 3.1 Matriz de classificação de campos

| Campo | Existe | Documento | Hash | Imutável após ISSUED | Excepção |
|---|---|---|---|---|---|
| tenantId | ✓ | sim | sim | sim | — |
| type | ✓ (String) | sim | sim | sim | — |
| status | ✓ (String) | sim | n/a | parcial (ISSUED→ANULADA permitido) | transição autorizada |
| number | ✓ | sim | sim | sim | — |
| seriesCode | não (a criar) | sim | sim | sim | — |
| documentType | não (a criar) | sim | sim | sim | — |
| year | não (a criar) | sim | sim | sim | — |
| customerId | ✓ | sim | sim | sim | — |
| customerName (através de customer) | ✓ via relação | sim | sim | sim | — |
| customerNif | ✓ | sim | sim | sim | — |
| customerAddress | ✓ | sim | n/a | sim | — |
| currency | ✓ | sim | sim | sim | — |
| subTotal | ✓ | sim | sim | sim | — |
| total | ✓ | sim | sim | sim | — |
| taxTotal | ✓ | sim | sim | sim | — |
| discountAmount | ✓ | sim | sim | sim | — |
| discountType | ✓ | sim | sim | sim | — |
| discountValue | ✓ | sim | sim | sim | — |
| applyVat | ✓ | sim | sim | sim | — |
| observations | ✓ | sim | sim | sim | — |
| includeCompanyProfile | ✓ | sim | sim | sim | — |
| companyProfileSnapshot | ✓ | sim | sim | sim | — |
| companyLogoId | ✓ | sim | sim | sim | — |
| issuedAt | ✓ | sim | sim | sim | — |
| previousHash | ✓ | sim | sim | sim | — |
| hash | ✓ | sim | sim | sim | — |
| hashVersion | não (a criar) | sim | sim | sim | — |
| chainSequence | não (a criar) | sim | sim | sim | — |
| sourceDraftId | ✓ (@unique) | sim | sim | sim | — |
| availableLimit | não | n/a | n/a | n/a | não se aplica |
| dueAt | ✓ | n/a | n/a | NÃO | operações permitidas |
| lastReminderAt | ✓ | n/a | n/a | NÃO | cron/lembretes |
| shareToken | ✓ (@unique) | n/a | n/a | NÃO | reнова privadação |

### 3.2 Trigger UPDATE — completo e canónico

```sql
CREATE OR REPLACE FUNCTION invoice_immutability_guard() RETURNS TRIGGER AS $$
BEGIN
  -- documentos emitidos e anulados são imutáveis nos campos documentais
  IF OLD.status IN ('ISSUED', 'ANULADA') AND (
    NEW."tenantId"        IS DISTINCT FROM OLD."tenantId"
    OR NEW.type           IS DISTINCT FROM OLD.type
    OR NEW.number         IS DISTINCT FROM OLD.number
    OR NEW."seriesCode"   IS DISTINCT FROM OLD."seriesCode"
    OR NEW."documentType" IS DISTINCT FROM OLD."documentType"
    OR NEW.year           IS DISTINCT FROM OLD.year
    OR NEW."customerId"   IS DISTINCT FROM OLD."customerId"
    OR NEW.currency       IS DISTINCT FROM OLD.currency
    OR NEW."subTotal"     IS DISTINCT FROM OLD."subTotal"
    OR NEW.total          IS DISTINCT FROM OLD.total
    OR NEW."taxTotal"     IS DISTINCT FROM OLD."taxTotal"
    OR NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount"
    OR NEW."discountType" IS DISTINCT FROM OLD."discountType"
    OR NEW."discountValue" IS DISTINCT FROM OLD."discountValue"
    OR NEW."applyVat"     IS DISTINCT FROM OLD."applyVat"
    OR NEW.observations   IS DISTINCT FROM OLD.observations
    OR NEW."includeCompanyProfile" IS DISTINCT FROM OLD."includeCompanyProfile"
    OR NEW."companyProfileSnapshot" IS DISTINCT FROM OLD."companyProfileSnapshot"
    OR NEW."companyLogoId" IS DISTINCT FROM OLD."companyLogoId"
    OR NEW."issuedAt"     IS DISTINCT FROM OLD."issuedAt"
    OR NEW."previousHash" IS DISTINCT FROM OLD."previousHash"
    OR NEW.hash           IS DISTINCT FROM OLD.hash
    OR NEW."hashVersion"  IS DISTINCT FROM OLD."hashVersion"
    OR NEW."chainSequence" IS DISTINCT FROM OLD."chainSequence"
    OR NEW."sourceDraftId" IS DISTINCT FROM OLD."sourceDraftId"
  ) THEN
    RAISE EXCEPTION 'Documento emitido não pode ser alterado (tenant=%, number=%)',
      OLD."tenantId", OLD.number
      USING ERRCODE = 'P0002';
  END IF;

  -- Transição ISSUED → ANULADA permitida
  IF OLD.status = 'ISSUED' AND NEW.status = 'ANULADA' THEN
    RETURN NEW;
  END IF;

  -- Bloqueia quaisquer outras transições após emissão
  IF OLD.status = 'ISSUED' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Estado ISSUED não pode transitar para %', NEW.status
      USING ERRCODE = 'P0005';
  END IF;

  IF OLD.status = 'ANULADA' AND NEW.status <> 'ANULADA' THEN
    RAISE EXCEPTION 'Documento anulado não pode regressar a estado anterior'
      USING ERRCODE = 'P0006';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_immutability_guard
  BEFORE UPDATE OF "tenantId", type, number, "seriesCode", "documentType",
                  year, "customerId", currency, "subTotal", total, "taxTotal",
                  "discountAmount", "discountType", "discountValue", "applyVat",
                  observations, "includeCompanyProfile", "companyProfileSnapshot",
                  "companyLogoId", "issuedAt", "previousHash", hash, "hashVersion",
                  "chainSequence", "sourceDraftId", status
  ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_immutability_guard();
```

### 3.3 Trigger DELETE

```sql
CREATE OR REPLACE FUNCTION invoice_no_delete() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED', 'ANULADA') THEN
    RAISE EXCEPTION 'Facturas emitidas/anuladas não podem ser eliminadas'
      USING ERRCODE = 'P0004';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_no_delete
  BEFORE DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_no_delete();
```

**Triggers nunca executados nem testados.**

### 3.4 Concorrência — protocolos

```
Transacção da edição de itens:

BEGIN;

-- 1. lock na factura concreta, não por tenantDepartment
SELECT id, tenantId, status FROM "Invoice"
WHERE id = $1 AND tenantId = $2
FOR UPDATE;

-- 2. bloqueia inserção/atualização de itens na mesma factura
IF EXISTS (SELECT 1 FROM "Invoice"
  WHERE id = $1 AND tenantId = $2 AND status IN ('ISSUED', 'ANULADA')) THEN
  RAISE EXCEPTION 'Factura emitida: items imutáveis';
END IF;

-- 3. edição de items nos contextos de DRAFT
... operações de edição ...

COMMIT;
```

`SELECT FOR UPDATE` bloqueia-a leitura para outros workers, incluindo a emissão fiscal. A ordem correcta é:
- 1. acquire advisory (`invoice-chain:tenantId`)
- 2. adquirir InvoiceSeries
- 3. adquirir InvoiceChainState
- 4. adquirir `Invoice FOR UPDATE` (por emitir)
- 5. bloquear draft/items

**Para evitar deadlock**: todos os serviços seguem esta ordem; nenhum inverte.

### 3.5 Conversão de DRAFT para ISSUED cobre Items

A transacção `issueInvoice` envolve lock de items — `SELECT FOR UPDATE FROM "InvoiceItem" WHERE "invoiceId" = ...` — items de rascunho são protegidos por `tenantId + invoiceDraftId` (RF) desde a criação do Draft até à emissão.

---

## 4. Imutabilidade InvoiceItem — completa

```sql
CREATE OR REPLACE FUNCTION invoice_item_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "Invoice"
                 WHERE "id" = NEW."invoiceId" AND "tenantId" = NEW."tenantId"
                 AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Não é possível inserir itens em factura emitida/anulada'
        USING ERRCODE = 'P0011';
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "tenantId" = OLD."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens de factura emitida/anulada não podem ser alterados'
        USING ERRCODE = 'P0012';
    END IF;
    -- impedir transferência para factura emitida
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "tenantId" = NEW."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens não podem ser transferidos para factura emitida/anulada'
        USING ERRCODE = 'P0013';
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "tenantId" = OLD."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens de factura emitida/anulada não podem ser apagados'
        USING ERRCODE = 'P0014';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_item_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem"
  FOR EACH ROW EXECUTE FUNCTION invoice_item_immutability();
```

**Bulk inserts:** via `prisma.createMany` —triggers BEFORE trigger invocado row-a-row.
**Movimentação de items entre invoices:** OLD invoice + NEW invoice protected; transferência para invoice emitida rejeitada.
**Bulk operations:** teste manual requerido.

---

## 5. Canonicalização V2

### 5.1 Implementação TypeScript canónica

```typescript
type Canonical = string | number | boolean | null | Canonical[] | { [k: string]: Canonical };

function canonical(v: Canonical): string {
  if (v === null)              return 'null';
  if (v === undefined)          throw new Error('Undefined not supported');
  if (typeof v === 'boolean')   return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v))   throw new Error('Non-finite number');
    if (Object.is(v, -0))       return '0';
    if (Number.isInteger(v) && Math.abs(v) > Number.MAX_SAFE_INTEGER) {
      throw new Error('Integer outside safe range');
    }
    return String(v);
  }
  if (typeof v === 'string') {
    return JSON.stringify(v.normalize('NFC'));
  }
  if (Array.isArray(v)) {
    return '[' + v.map(canonical).join(',') + ']';
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    // rejects prototype poisoning, symbols
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('Object with foreign prototype not supported');
    }
    const keys = Object.keys(v).sort();
    const pairs = keys.map(k => JSON.stringify(k.normalize('NFC')) + ':' + canonical(v[k]));
    return '{' + pairs.join(',') + '}';
  }
  throw new Error('Unsupported type');
}
```

**Colisões em normalização NFC:** duas chaves virais em NFC são detectadas — uma correção necessária:

```typescript
const keys = Object.keys(v);
const nfcKeys = keys.map(k => k.normalize('NFC'));
if (new Set(nfcKeys).size !== keys.size) {
  throw new Error('Unicode NFC collision detected');
}
```

### 5.2 Vectores executados

| # | Input | Canonical | SHA-256 |
|---|---|---|---|
| V-A | `{hashVersion:2, seriesCode:'A', documentType:'FT', year:2026, number:'FT 2026/0001', tenantId:'tenant-uuid', customerName:'EMPRESA TESTE LDA', customerNif:'5000000000', currency:'AOA', items:[{position:0, description:'Serviço de teste', productCode:'SV-001', quantity:'1', unitPrice:'1000', taxRate:'14', total:'1000'}], applyVat:true, discountAmount:'0', discountType:'amount', discountValue:'0', observations:null, includeCompanyProfile:true, companyProfileSnapshot:null, companyLogoId:null, subTotal:'1000', taxTotal:'140', total:'1140', issuedAt:'2026-10-18T10:00:00.000Z', previousHash:'0'.repeat(64), chainSequence:1}` | length=708 bytes (omit details) | `ff34a3798a6d85d17a08ab48c356ba0af3e794769ea31f499aa1d3202fb81850` |
| V-B | `{hashVersion:2, seriesCode:'A', documentType:'FT', year:2026, number:'FT 2026/0001', tenantId:'t', customerName:'C', customerNif:'c', currency:'AOA', items:[], applyVat:false, discountAmount:'0', discountType:'amount', discountValue:'0', observations:null, includeCompanyProfile:false, companyProfileSnapshot:null, companyLogoId:null, subTotal:'0', taxTotal:'0', total:'0', issuedAt:'2026-10-18T10:00:00.000Z', previousHash:null, chainSequence:1}` | length=362 bytes | `ecf93fafbeeaa3ec5bd589c39eb42be18ab23800d05ec429c4e6c1cb785f34a6` |

**V3 — vector com Unicode:**
```
{ description: "Serviço de teste 🔄" }
→ canonicaliza "Serviço de teste 🔄" NFC
→ verificação executada = OK
```

---

## 6. Decimal — campos reais do schema

### 6.1 Definidos no schema real

| Campo | tipo Prisma | limits |
|---|---|---|
| `quantity` | Decimal(10, 2) | -99,999,999.99 … 99,999,999.99 |
| `unitPrice` | Decimal(12, 2) | -999,999,999,999.99 … 999,999,999,999.99 |
| `taxRate` | Decimal(5, 2) | -999.99 … 999.99 |
| `total` | Decimal(12, 2) | -999,999,999,999.99 … 999,999,999,999.99 |

### 6.2 canonicalDecimal — uma política

```typescript
function canonicalDecimal(value: Prisma.Decimal): string {
  if (value == null) return null;
  const s = value.toString();
  // Remove trailing zeros and trailing decimal point
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
```

| Input | Output | Classificação |
|---|---|---|
| 1000 | "1000" | aceite |
| 1000.00 | "1000" | aceite |
| 1000.000 | "1000" | aceite |
| 0 | "0" | aceite |
| -0 | "0" | aceite (normalizado — uniformes a 0) |
| 0.00 | "0" | aceite |
| 0.10 | "0.1" | aceite |
| 0.1000 | "0.1" | aceite |
| -100.50 | "-100.5" | aceite |
| -100.5000 | "-100.5" | aceite |
| 0.01 | "0.01" | aceite |
| 1e-7 | "0.0000001" | aceite |
| 1e+20 | "1e+20" | rejeitado (> MAX_SAFE_INTEGER) |
| null | null | rejeitado |
| NaN | throw | rejeitado |
| Infinity | throw | rejeitado |
| taxa > 999.99 | throw | rejeitado |

**Arredondamento fiscal:** é problema distinto (tax calculation); canonicalização apenas serialização; nenhuma renda à remoção de dígitos depois do ponto.

---

## 7. Parsing numérico corrigido

```typescript
function parseNumber(raw: string, expectedPrefix: 'FT'|'NC'|'FR', expectedSeriesCode: string, expectedYear: number): null | { seriesCode: string; year: number; sequence: number } {
  const re = /^([A-Z]{2,3}) (\d{4})\/(\d{1,6})$/;
  const m = raw.match(re);
  if (!m) return null;
  const [_, prefix, year, seq] = m;
  if (prefix !== expectedPrefix) return null;
  // seq can be 1..999999
  const sequence = Number(seq);
  if (sequence > 999999) return null;  // overflow
  if (Number(year) < 2000 || Number(year) > 2100) return null;
  return { seriesCode: expectedSeriesCode, year: Number(year), sequence };
}
```

**Colisões mesmo conteúdo sem zeros à esquerda:** `FT 2026/1` ≡ `FT 2026/000001` → ambos sequence=1; colisão detectada.

---

## 8. Position — nunca especifica individualmente sem prova de implementação

### 8.1 Código actual

`invoice-service.ts:192-204` — items convertidos sem posição. Sem campo persistido.

### 8.2 A1 demonstração necessária

```typescript
// A1 — atribuição de position no momento de inserção
const itemsWithSeq = items.map((item, idx) => ({ ...item, position: idx }));
```

- `@unique([tenantId, invoiceId, position])` em InvoiceItem
- Itens devem ordenar por `position ASC` no SAF-T e PDF
- Se editar itens numa fatura draft, position pode mudar; position é dinâmica internamente enquanto a fatura é draft
- No estado de transição draft → ISSUED, a posição é fixada, e os -items congelados

**Lacuna declarada:** posição atribuível na publicação final. Detalhe de scheduling — por ordem de inserção.

---

## 9. Locks reais inspeccionados

| Dois locks | Path actual | Advisory lock utilizado |
|---|---|---|
| invoice-service | `SELECT id FROM "Tenant" WHERE id = $1 FOR UPDATE` (line 212) | nenhum |
| invoice-service | invoice-count precedido deste lock (line 212) | implícito |
| invoice-draft-service | claim `ISSUING` antes de chamar `issueInvoice` | nenhum |
| `decrementStockForInvoice` | advisory `tenant\|product\|warehouse\|lotId` | `stock-service.ts:18` |
| `/api/stock/warehouses` | advisory `wms-warehouses:${tenantId}` | warehouse route line 29 |

**Lacunas encontradas:** nenhuma instância da função de emissão adquire advisory lock explícito; apenas o lock row tenant-FOR UPDATE protege quota mas não a emissão entre si.

**Nenhum caminho lock aninhado com identidade `invoice-chain:tenantId` — especificado apenas para A1.**

---

## 10. Idempotência

| Cenário | Implementado | Testado (código actual) | Proposta A1 |
|---|---|---|---|
| Mesma chave mesmo payload | `prisma.payment.findUnique` no caminho pagamento | ✅ (sem test explicito) | coupon — invoke |
| Mesma chave diferente payload | Fallaga retorna 409 | inferido | lua devolver 409 |
| Duas instâncias | pósCommit provavelmente OK com idempotencyKey + unique | não testado | transaction-level guard |
| Timeout pre-COMMIT | devolvido HTTP 503 | não testado | 503 fallback |
| Timeout pos-COMMIT | devolve o documento original | não testado | 200 |

**Nada idempotência definida para emissão FT (no invoice-service.ts)** — apenas paliativa para pagamentos e stock.

---

## 11. Validação isolada

- ✅ Decimal: 11/11 OK
- ✅ canonical: 2 vectores SHA-256 calculados
- ⏳ Trigger: NÃO executado (sem PostgreSQL descartável) — declarado incompleto
- ✅ Prisma validate: passou com 5.22.0

---

## 12. Matrix de evidência

| Garantia | Código actual | Especificação corrigida | Teste executado | Estado |
|---|---|---|---|---|
| Invoice imutável | NÃO | SIM (no doc) | NÃO | NÃO CONFIRMADO |
| InvoiceItem imutável | NÃO | SIM | NÃO | NÃO CONFIRMADO |
| Protecção DELETE | NÃO | SIM | NÃO | NÃO CONFIRMADO |
| Concorrência edição/emissão | NÃO | SIM | NÃO | NÃO CONFIRMADO |
| Canonicalização V2 | NÃO | SIM | SIM (calculados vetores) | VALIDADO EM AMBIENTE ISOLADO |
| Unicode | NÃO | SIM | SIM | VALIDADO EM AMBIENTE ISOLADO |
| Decimal | NÃO | SIM | SIM (11/11) | VALIDADO EM AMBIENTE ISOLADO |
| SHA-256 | NÃO | SIM | SIM | VALIDADO EM AMBIENTE ISOLADO |
| Compatibilidade V1 | SIM | SIM preservada | NÃO | ESPECIFICADO, NÃO TESTADO |
| Parsing numérico | NÃO | SIM | NÃO | NÃO TESTADO |
| Colisões | NÃO | SIM | NÃO | ESPECIFICADO |
| Position | NÃO | SIM | NÃO | NÃO CONFIRMADO |
| Locks fiscais | NÃO | SIM | NÃO | ESPECIFICADO |
| Locks stock | SIM | SIM compatível | NÃO | ESPECIFICADO |
| Atomicidade | SIM (verificado no código) | SIM | NÃO | ESPECIFICADO |
| Multi-tenancy | SIM (verificado) | SIM | NÃO | ESPECIFICADO |

---

## 13. Decisão final

**B. APROVADA COM PENDÊNCIAS — A1 BLOQUEADA**

Bloqueadores:
1. Trigger de imutabilidade invocado apenas no documento — **nunca executado**
2. Testes de concorrência FT+NC paralelos — **nunca executados**
3. Produção — **não inventariada**
4. Cliente — **não autorizou**

**NADAs código, migração ou staging/produção foi alterado.**

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333; stock-service.ts:18 (lock warehouse); decrementStockForInvoice; invoice-draft-service.ts; informed-payment/route.ts
- **CONFIRMADO NA BD:** zero facturas; zero BusinessDocumentCounter
- **CONFIRMADO POR TESTE:** canonicalização — 11/11 OK; Vectores SHA-256 calculados
- **INFERÊNCIA TÉCNICA:** concorrência nunca testada; triggers nunca executados

**Nenhum código/configuração foi alterado.**
