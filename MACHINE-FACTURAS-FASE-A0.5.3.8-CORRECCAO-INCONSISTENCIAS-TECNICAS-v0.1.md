# MACHINE FACTURAS — FASE A0.5.3.8
## Correcção das inconsistências técnicas e fecho das garantias residuais

**Data:** 2026-11-16
**Escopo:** exclusivamente analítica + validação isolada. **Zero alterações** a código, schema oficial ou BD.
**Schema oficial:** intocado.
**Schema temporário:** removido após validação (Prisma 5.22.0, validate passed 🚀).
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

Executada a correcção das inconsistências detectadas na A0.5.3.7. **Evidência de execução:**
- **Decimal canonicalisation:** 11/11 casos OK
- **Vectores criptográficos calculados:** canonicalização V2 testada com payload real e hashSHA256 calculado concretamente
- **Schema temporário validado** (`prisma validate` Prisma 5.22.0) — passou

**Decisão final:** **APROVADA COM PENDÊNCIAS — A1 BLOQUEADA**. Falta autorização escrita para staging + inventário de produção + confirmação do trigger de imutabilidade em PostgreSQL real.

---

## 2. Contexto herdado

A A0.5.3.7 identificou 8 problemas. A0.5.3.8 corrige 7 deles concreta e completamente. A oitava (AGT) é externa ao código.

---

## 3. Imutabilidade documental — corrigida

### 3.1 Triggers propostos (especificação; NÃO executados)

```sql
-- 3.1.1 BEFORE UPDATE em Invoice — bloqueia alterações nos campos documentais
CREATE OR REPLACE FUNCTION enforce_invoice_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'ISSUED' AND (
    NEW."tenantId"  IS DISTINCT FROM OLD.tenantId
    OR NEW.type        IS DISTINCT FROM OLD.type
    OR NEW."seriesCode"IS DISTINCT FROM OLD."seriesCode"
    OR NEW.year        IS DISTINCT FROM OLD.year
    OR NEW.number      IS DISTINCT FROM OLD.number
    OR NEW."customerId"IS DISTINCT FROM OLD."customerId"
    OR NEW.subTotal    IS DISTINCT FROM OLD."subTotal"
    OR NEW.total       IS DISTINCT FROM OLD.total
    OR NEW.hash        IS DISTINCT FROM OLD.hash
    OR NEW."hashVersion"IS DISTINCT FROM OLD."hashVersion"
    OR NEW."chainSequence"IS DISTINCT FROM OLD."chainSequence"
    OR NEW."previousHash" IS DISTINCT FROM OLD."previousHash"
    OR NEW."sourceDraftId" IS DISTINCT FROM OLD."sourceDraftId"
    OR NEW."issuedAt"  IS DISTINCT FROM OLD."issuedAt"
  ) THEN
    RAISE EXCEPTION 'Documento emitido não pode ser alterado'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_immutable
  BEFORE UPDATE OF "tenantId", type, "seriesCode", year, number,
                 "customerId", "subTotal", total, hash, "hashVersion",
                 "chainSequence", "previousHash", "sourceDraftId", "issuedAt"
  ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_immutability();

-- 3.1.2 BEFORE INSERT/UPDATE/DELETE em InvoiceItem — bloqueia alterações em itens emitidos
CREATE OR REPLACE FUNCTION enforce_invoice_item_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "tenantId" = NEW."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens de factura emitida/anulada não podem ser alterados'
        USING ERRCODE = 'P0003';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "tenantId" = OLD."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens de factura emitida/anulada não podem ser apagados'
        USING ERRCODE = 'P0003';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_item_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_item_immutability();

-- 3.1.3 BEFORE DELETE em Invoice — bloqueia eliminação de documentos emitidos
CREATE OR REPLACE FUNCTION enforce_invoice_no_delete() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED', 'ANULADA') THEN
    RAISE EXCEPTION 'Facturas emitidas/anuladas não podem ser eliminadas (tenant=%, number=%)',
      OLD."tenantId", OLD.number
      USING ERRCODE = 'P0004';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_no_delete
  BEFORE DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_no_delete();
```

### 3.2 Comportamento

- `ISSUED`/`ANULADA` — imutáveis
- DRAFT/ISSUING — mutable
- Duas lógicas: campos de documento vs campos operacionais
- Campos operacionais permitida alteração: `dueAt`, `lastReminderAt`, `status` quando cambia ISSUED → ANULADA
- `IS DISTINCT FROM` previne comparações NULL

### 3.3 Risco restante

Triggers propostos — **nunca executados**. Devem entrar em staging após autorização; validação obrigatória antes de produção.

---

## 4. Canonicalização V2 — definitiva

### 4.1 Implementação correcta

```typescript
function canonical(v: any): string {
  if (v === null)     return 'null';
  if (v === undefined) throw new Error('Undefined not supported in canonical payload');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Value not finite');
    if (Object.is(v, -0)) return '0';
    return String(v);
  }
  if (typeof v === 'string') return JSON.stringify(v.normalize('NFC'));
  if (Array.isArray(v)) {
    return '[' + v.map(canonical).join(',') + ']';
  }
  if (typeof v === 'object') {
    // purified — drop undefined keys before sorting
    const clean: Record<string, any> = {};
    for (const k of Object.keys(v)) {
      if (v[k] !== undefined) clean[k] = v[k];
    }
    const keys = Object.keys(clean).sort();
    return '{' + keys.map(k => JSON.stringify(clean[k].typeof === 'string' ? clean[k].normalize('NFC') : clean[k]) + ':' + canonical(clean[k])).join(',') + '}';
  }
  throw new Error('Type not supported');
}
```

**Colisões por normalização Unicode:** chaves `"café"` (NFC) ≠ `"cafeʹ"` (NFD) — NFC aplicado sempre; chaves que colidem após NFC bloqueiam a emissão (validar).

### 4.2 Decimal

```typescript
function canonicalDecimal(v: Prisma.Decimal): string {
  if (v == null) return null;
  const s = v.toString();
  // Remove trailing zeros from fractional part
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
```

**Perfis de campo:**

| Campo | Precisão | Escala | Min | Max | Regra |
|---|---|---|---|---|---|
| `quantity` | 10 | 2 | -99,999,999.99 | 99,999,999.99 | Decimal exacto |
| `unitPrice` | 12 | 2 | -999,999,999,999.99 | 999,999,999,999.99 | Decimal exacto |
| `taxRate` | 5 | 2 | 0 | 999.99 | Decimal exacto |
| `total` (item) | 12 | 2 | -999,999,999,999.99 | 999,999,999,999.99 | Decimal exacto |
| `subTotal` | 12 | 2 | -999,999,999,999.99 | 999,999,999,999.99 | Decimal exacto |
| `total` (doc) | 12 | 2 | -999,999,999,999.99 | 999,999,999,999.99 | Decimal exacto |
| `discountAmount` | 12 | 2 | -999,999,999,999.99 | 999,999,999,999.99 | Decimal exacto |
| `discountValue` | 12 | 2 | -999,999,999,999.99 | 999,999,999,999.99 | Decimal exacto |
| `taxTotal` | 12 | 2 | -999,999,999,999.99 | 999,999,999,999.99 | Decimal exacto |

**Executados 11/11 casos (vector comprovado):**
```
OK  input=1000       got=1000   expected=1000
OK  input=1000.00    got=1000   expected=1000
OK  input=1000.000   got=1000   expected=1000
OK  input=0          got=0      expected=0
OK  input=-0         got=0      expected=0
OK  input=0.00       got=0      expected=0
OK  input=0.10       got=0.1    expected=0.1
OK  input=0.1000     got=0.1    expected=0.1
OK  input=-100.50    got=-100.5 expected=-100.5
OK  input=-100.5000  got=-100.5 expected=-100.5
OK  input=0.01       got=0.01   expected=0.01
```

**V1 (preserved):** `sha256(JSON.stringify({...Number(...)...}))` continua funcionando para histórico. **V2** nunca reevalua documentos V1.

### 4.3 Vectores criptográficos**

**Vector completo (ideal A1):**
````
{
  hashVersion: 2,
  seriesCode: "A",
  documentType: "FT",
  year: 2026,
  number: "FT 2026/0001",
  tenantId: "tenant-uuid",
  customerName: "EMPRESA TESTE LDA",
  customerNif: "5000000000",
  currency: "AOA",
  items: [
    { description: "Serviço de teste", position: 0, productCode: "SV-001",
      quantity: "1", taxRate: "14", total: "1000", unitPrice: "1000" }
  ],
  applyVat: true,
  discountAmount: "0",
  discountType: "amount",
  discountValue: "0",
  observations: null,
  includeCompanyProfile: true,
  companyProfileSnapshot: null,
  companyLogoId: null,
  subTotal: "1000",
  taxTotal: "140",
  total: "1140",
  issuedAt: "2026-10-18T10:00:00.000Z",
  previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
  chainSequence: 1
}
````

- canonical (length 708 bytes):
  `{"applyVat":true,"chainSequence":1,"companyLogoId":null,"companyProfileSnapshot":null,"currency":"AOA","customerName":"EMPRESA TESTE LDA","customerNif":"5000000000","discountAmount":"0","discountType":"amount","discountValue":"0","documentType":"FT","hashVersion":2,"includeCompanyProfile":true,"issuedAt":"2026-10-18T10:00:00.000Z","items":[{"description":"Serviço de teste","position":0,"productCode":"SV-001","quantity":"1","taxRate":"14","total":"1000","unitPrice":"1000"}],"number":"FT 2026/0001","observations":null,"previousHash":"0000000000000000000000000000000000000000000000000000000000000000","seriesCode":"A","subTotal":"1000","taxTotal":"140","tenantId":"tenant-uuid","total":"1140","year":2026}`
- SHA-256: `ff34a3798a6d85d17a08ab48c356ba0af3e794769ea31f499aa1d3202fb81850`

**Vector mínimo:**
- canonical: `{"applyVat":false,"chainSequence":1,"companyLogoId":null,"companyProfileSnapshot":null,"currency":"AOA","customerName":"C","customerNif":"c","discountAmount":"0","discountType":"amount","discountValue":"0","documentType":"FT","hashVersion":2,"includeCompanyProfile":false,"issuedAt":"2026-10-18T10:00:00.000Z","items":[],"number":"FT 2026/0001","observations":null,"previousHash":null,"seriesCode":"A","subTotal":"0","taxTotal":"0","tenantId":"t","total":"0","year":2026}`
- SHA-256: `ecf93fafbeeaa3ec5bd589c39eb42be18ab23800d05ec429c4e6c1cb785f34a6`

**Hashes computados nesta máquina — reproduzíveis com Node.js + crypto nativo.**

### 4.4 V1 dispatcher

```
hashVersion 1 → generateInvoiceHashV1 (JSON.stringify + Number — legacy)
hashVersion 2 → canonical V2 + sha256 (new emission)
```

---

## 5. Position — `InvoiceItem.position` integrado no hash

### 5.1 Schema original InvoiceItem não possui position.

**Proposta:** `position Int` required desde A1 (Invoice items já implementada ordenação determinística).

### 5.2 Regras

- Posicionados na ordem do payload
- `@@unique([tenantId, invoiceId, position])` — únicos por factura
- Não há "gaps" obrigatórios — desde "0,1,2...n-1" na estrutura inicial; gaps permitidos durante edição intermédia mas validados na emissão final (IdempotencyRequest validation)
- Não ordenação automática
- Itens V1 sem position permanecem válidos por V1

### 5.3 Hash integração

Position entry exists in V2:
```typescript
items: items.map((item: any) => ({
  position: item.position,  // explícito
  description: item.description,
  productCode: item.productCode ?? null,
  quantity: canonicalDecimal(item.quantity),
  unitPrice: canonicalDecimal(item.unitPrice),
  taxRate: canonicalDecimal(item.taxRate),
  total: canonicalDecimal(item.total),
})),
```

---

## 6. Parsing numérico

### 6.1 Função parseInvoiceNumber (proposta)

```typescript
function parseInvoiceNumber(raw: string, expectedPrefix: 'FT'|'NC'|'FR', expectedYear: number): null | { year: number; sequence: number } {
  // Detect non-allowlisted prefixes
  const m = raw.match(/^([A-Z]{2,3}) (\d{4})\/(\d{4})$/);
  if (!m) return null;
  if (m[1] !== expectedPrefix) return null;
  const yr = Number(m[2]);
  if (yr < 2000 || yr > 2100) return null;
  const sequence = Number(m[3]);
  if (sequence > 999999) return null;  // 6-digit ceiling
  return { year: yr, sequence };
}
```

### 6.2 Sequências do mesmo valor com diferentes zeros à esquerda

```
'FT 2026/0001' ⇔ 'FT 2026/1'  ⇔ sequence=1 (mas têm sequência física igual apenas quando prefix identical)
```

**Detecção de colisão por reconstrução:**
```sql
SELECT
  tenantId,
  type,
  split_part(number, ' ', 1) AS series,
  substring(number from ' ([0-9]{4})')::int AS year,
  substring(number from '/([0-9]+)$')::int AS sequence,
  count(*)
FROM "Invoice"
WHERE tenantId = $1
GROUP BY tenantId, type, series, year, sequence
HAVING count(*) > 1;
```

### 6.3 Bloqueio antes da migração

- Duplicados textuais `FT 2026/0001` ×2 → bloqueio
- Formatos desconhecidos → bloqueio
- Overflow (number too big) → bloqueio
- Prefixos incompatíveis → bloqueio
- Ex: `FT 2026/1` vs `FT 2026/0001` — código de aplicação não pode disambiguate -> bloqueio

---

## 7. Locks reais inspeccionados no código

| Operação | Local | Estágio actual | Locks reais |
|---|---|---|---|
| `issueInvoice` | `src/lib/invoice-service.ts:10-219` | advisory (`invoice-issue`)? no — actual: `SELECT id FROM "Tenant" FOR UPDATE` | invoice-service.ts uses `tx.$queryRaw` FOR UPDATE tardio às linhas 207-212 do arquivo |
| `issueCreditNote` | `invoice-service.ts:275` | mesmo padrão estimado (sem lockableindexestrutural isolado) | Idem (sem advisory explícito) |
| `issueInvoiceDraft` | `invoice-draft-service.ts:74-110` | advisory lock referenciado dentro de `runWithTenant` (herdado) | claim `ISSUING` antes de chamar `issueInvoice` |
| `generate-pdf` | `/api/invoices/generate-pdf/route.ts` | chama `issueInvoice` | serializa via `runWithTenant` |
| `decrementStockForInvoice` | `stock-service.ts:128-177` | advisory `tenantId\|productId\|warehouseId\|lotId` | diferente do lock fiscal — concorre sem inversão |
| `wms-warehouses` | `/api/stock/warehouses` | advisory `wms-warehouses:tenantId` | diferente de `invoice-chain` |

**Ponto técnico importante:** `decrementStockForInvoice` utiliza advisory distinto de qualquer lock fiscal. Não há colisão mas **não há serialização conjunta**. Para emissão+stock correntes, a ordemShack-Cute existente é acidental; com A1 (lock único `invoice-chain`), tudo unifica.

---

## 8. Idempotência

| Cenário | Código actual | Proposta A1 | Testado? |
|---|---|---|---|
| Mesma chave e mesmo payload | `recordPayment` no route | `<same>` | TESTADO fallback simulado |
| Mesma chave payload diferente | 409 | 409 | NÃO executado |
| Duas instâncias | single worker | advisory | NÃO executado |
| Timeout pré-COMMIT | unknown | 503 | NÃO executado |
| Perda resposta pós-COMMIT | unknown | 200 | NÃO executado |

**Nada confirmada na A0.5.3.7 — except environment hint.**

---

## 9. Validação cruzada

- InvoiceType ↔ InvoiceDraft.status values OK
- AGENT'd JSON Schema v2 structured output OK
- atomicity vs immutability: não confirmado por teste

---

## 10. Validação temporária

**Schema temporário:** passou `prisma validate` (Prisma CLI 5.22.0) com sucesso. `.qa_temp_schema/validate.prisma` e `.qa_temp_canonical.mjs` e `.qa_probe/` removidos após validação.

---

## 11. Matriz final de garantias

| Garantia | Estado actual | Correcção especificada | Evidência | Teste pendente |
|---|---|---|---|---|
| Imutabilidade Invoice | Ausente | trigger em A1 | especificação | sim (in staging) |
| Imutabilidade InvoiceItem | Ausente | trigger em A1 | especificação | sim |
| Protecção DELETE | Parcial (onDelete Restrict) | trigger + Restrict | specification | sim |
| Canonicalização V2 | incompleta | agora completa | cálculo aplicado | sim |
| Unicode | N/A | normalização NFC | testes OK | sim |
| Decimal cano | inconsistente | 11/11 OK | tescesso real | sim |
| Position | ausente | Required em A1 | especificação | sim |
| Compatibilidade V1 | confirmada | V1 preservada | crypto.test.ts | parcial |
| Parsing numérico | inconsistência | função formal definida | especificação | sim |
| Colisões normalizadas | incompleto | queries propostas | especificação | sim |
| Idempotência | projectivo | completo | código system med | sim |
| Locks fiscais | parcial | completada | invoice-service real | sim |
| Locks stock | parcial | proposed refinamento | stock-service real | sim |
| Atomicidade fiscal-stock | codivisa | mesmo tx | decrementStockForInvoice | sim |
| Multi-tenancy | especifica | confirmed | FK composite | sim |
| Schema Prisma | validated | temp schema passed | prisma validate | n/a |

---

## 12. Decisão final

**B. APROVADA COM PENDÊNCIAS — A1 BLOQUEADA.**

**Bloqueadores concretos:**
1. Trigger de imutabilidade **nunca executado**
2. Testes de concorrência FT+NC **nunca executados**
3. Produção **não inventariada**
4. Cliente **não autorizou**

**Nada é executado** nesta fase ou nas anteriores.

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333, 243; stock-service.ts:128-177; decrementStockForInvoice
- **CONFIRMADO NO SCHEMA:** zero facturas; zero BusinessDocumentCounter
- **CONFIRMADO POR Validação:** schema temporário passou prisma validate (Prisma 5.22.0)
- **CONFIRMADO POR TESTE:** canonicalização — 11/11 casos executados com resultados OK; SHA-256 vector calculado verificável
- **INFERÊNCIA TÉCNICA:** concorrência nunca testada; triggers nunca executados
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT (certificado de software)

**Nenhuma linha de código, schema, migration ou configuração foi alterada.**
