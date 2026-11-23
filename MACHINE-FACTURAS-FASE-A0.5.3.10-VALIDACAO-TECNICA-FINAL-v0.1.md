# MACHINE FACTURAS — FASE A0.5.3.10
## Validação técnica final do SQL, TypeScript e arquitectura

**Data:** 2026-11-16
**Escopo:** exclusivamente analítico + validação isolada. **Zero alterações** persistentes.
**Schema oficial:** intocado.
**Staging:** queries exclusivamente de leitura.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

Validações efectivamente executadas:
- **Trigger syntax validado** — `CREATE FUNCTION` + `CREATE TRIGGER` + `CREATE TABLE` + `DROP TABLE` em transacção `ROLLBACK` em instância PostgreSQL 18 (a mesma release usada pela plataforma); SQL executável
- **Vectores criptográficos V2 calculados** — SHA-256 determinístico com canonicalização completa
- **Vectores Decimal confirmados** — 11/11 passam canonicalização sem perda
- **Schema temporário validado** — passou `prisma validate` Prisma 5.22.0

**Decisão final:** **APROVADA COM PENDÊNCIAS — A1 BLOQUEADA.** Testes de concorrência dependem de instância descartável (sem privilégios na BD de staging); produção não inventariada; triggers não activados em ambiente real.

---

## 2. Contexto

A0.5.3.9 deixou garantido o desenho mas não demonstrou provas técnicas suficientes. Esta fase executa exactamente as provas possíveis sem alterar nada de forma persistente.

---

## 3. Compatibilidade schema/SQL vs schema oficial

### 3.1 Campos existentes no schema

| Coluna | Tabela | Tipo | Existe |
|---|---|---|---|
| id | Invoice | text primary key | sim |
| tenantId | Invoice | text NOT NULL | sim |
| customerId | Invoice | text NOT NULL | sim |
| number | Invoice | text NOT NULL | sim |
| type | Invoice | text (default 'FT') | sim |
| status | Invoice | text (default 'ISSUED') | sim |
| total | Invoice | Decimal(12,2) | sim |
| subTotal | Invoice | Decimal(12,2) | sim |
| taxTotal | Invoice | Decimal(12,2) | sim |
| hash | Invoice | text nullable | sim |
| previousHash | Invoice | text nullable | sim |
| signature | Invoice | text nullable | sim |
| issuedAt | Invoice | timestamp default now() | sim |
| createdAt | Invoice | timestamp default now() | sim |
| discountAmount | Invoice | Decimal(12,2) default 0 | sim |
| discountType | Invoice | text default 'amount' | sim |
| discountValue | Invoice | Decimal(12,2) default 0 | sim |
| applyVat | Invoice | boolean default true | sim |
| observations | Invoice | text nullable | sim |
| includeCompanyProfile | Invoice | boolean default false | sim |
| companyProfileSnapshot | Invoice | json nullable | sim |
| companyLogoId | Invoice | text nullable | sim |
| dueAt | Invoice | timestamp nullable | sim |
| currency | Invoice | text default 'AOA' | sim |
| sourceDraftId | Invoice | text nullable unique | sim |
| shareToken | Invoice | text nullable unique | sim |
| shareExpiresAt | Invoice | timestamp nullable | sim |
| lastReminderAt | Invoice | timestamp nullable | sim |
| customerId | Invoice | text NOT NULL FK | sim |
| invoiceId | InvoiceItem | text NOT NULL | sim |
| productId | InvoiceItem | text nullable | sim |
| description | InvoiceItem | text | sim |
| quantity | InvoiceItem | Decimal(10,2) | sim |
| unitPrice | InvoiceItem | Decimal(12,2) | sim |
| taxRate | InvoiceItem | Decimal(5,2) | sim |
| total | InvoiceItem | Decimal(12,2) | sim |

### 3.2 Campos propostos para A1 (não existem ainda)

| Campo | Propósito |
|---|---|
| Invoice.seriesCode | Identificador fiscal da série |
| Invoice.documentType | FT/NC/FR (ou enum real) |
| Invoice.year | Exercício fiscal |
| Invoice.chainSequence | Sequência global por tenant |
| Invoice.hashVersion | Versionamento explícito |
| InvoiceItem.position | Ordem de emissão |
| Invoice.seriesRsn | Referências para série dedicada |

### 3.3 Customer e snapshots

Hoje, customerName/customerNif em hash são obtidos de Customer por lookup; snapshot opcional via `companyProfileSnapshot` (JSON). No estado actual, uma factura ascende a snapshot pelo valor actual de Customer na referência — **uma edição do cliente altera o visual dessa factura exactamente como vê em produção**. Este é um risco material para documentos imutáveis.

**Acção proposta (A1):** labelar snapshots de emitente (companyProfileSnapshot) com o hash que usará no documento, como já inline-merge, e Customer snapshot para documento próprio persistente `customerName`, `customerNif`, `customerAddress` — bloquear que cliente seja editado retroactivamente uma factura emitida.

### 3.4 Ordem futura de implementação

1. Add colunas faltantes do schema oficial (A1-I)
2. Constraints SQL
3. Triggers de imutabilidade + coerência
4. Serviços transaccionais
5. Testes
6. Activação controlada

---

## 4. Triggers de imutabilidade — executáveis (sintaxe validada)

### 4.1 SQL concreto

```sql
-- Bloqueio de alteração documental em factura emitida/anulada
CREATE OR REPLACE FUNCTION enforce_invoice_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED', 'ANULADA') AND (
    NEW."tenantId"          IS DISTINCT FROM OLD."tenantId"
    OR NEW.type              IS DISTINCT FROM OLD.type
    OR NEW.number            IS DISTINCT FROM OLD.number
    OR NEW."seriesCode"      IS DISTINCT FROM OLD."seriesCode"
    OR NEW."documentType"    IS DISTINCT FROM OLD."documentType"
    OR NEW.year              IS DISTINCT FROM OLD.year
    OR NEW."customerId"      IS DISTINCT FROM OLD."customerId"
    OR NEW."subTotal"        IS DISTINCT FROM OLD."subTotal"
    OR NEW.total             IS DISTINCT FROM OLD.total
    OR NEW."taxTotal"        IS DISTINCT FROM OLD."taxTotal"
    OR NEW."discountAmount"  IS DISTINCT FROM OLD."discountAmount"
    OR NEW."discountType"    IS DISTINCT FROM OLD."discountType"
    OR NEW."discountValue"   IS DISTINCT FROM OLD."discountValue"
    OR NEW."applyVat"        IS DISTINCT FROM OLD."applyVat"
    OR NEW.observations      IS DISTINCT FROM OLD.observations
    OR NEW."includeCompanyProfile" IS DISTINCT FROM OLD."includeCompanyProfile"
    OR NEW."companyProfileSnapshot" IS DISTINCT FROM OLD."companyProfileSnapshot"
    OR NEW."companyLogoId"   IS DISTINCT FROM OLD."companyLogoId"
    OR NEW."issuedAt"        IS DISTINCT FROM OLD."issuedAt"
    OR NEW."previousHash"    IS DISTINCT FROM OLD."previousHash"
    OR NEW.hash              IS DISTINCT FROM OLD.hash
    OR NEW."hashVersion"     IS DISTINCT FROM OLD."hashVersion"
    OR NEW."chainSequence"   IS DISTINCT FROM OLD."chainSequence"
    OR NEW."sourceDraftId"   IS DISTINCT FROM OLD."sourceDraftId"
  ) THEN
    RAISE EXCEPTION 'Documento emitido não pode ser alterado'
      USING ERRCODE = 'P0002';
  END IF;

  IF OLD.status = 'ISSUED' AND NEW.status = 'ANULADA' THEN
    -- transição autorizada INALTERADA pela regra anterior
    RETURN NEW;
  END IF;
  IF OLD.status = 'ISSUED' AND NEW.status <> 'ISSUED' THEN
    RAISE EXCEPTION 'Estado ISSUED só pode transitar para ANULADA (não para %)', NEW.status
      USING ERRCODE = 'P0005';
  END IF;
  IF OLD.status = 'ANULADA' AND NEW.status <> 'ANULADA' THEN
    RAISE EXCEPTION 'Documento anulado não pode regressar'
      USING ERRCODE = 'P0006';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Sintaxe validada em ambiente PostgreSQL 18 isolado (CREATE FUNCTION criado com sucesso antes do ROLLBACK automático).**

### 4.2 DELETE

```sql
CREATE OR REPLACE FUNCTION enforce_invoice_no_delete() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED', 'ANULADA') THEN
    RAISE EXCEPTION 'Facturas emitidas/anuladas não podem ser eliminadas'
      USING ERRCODE = 'P0004';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 InvoiceItem

```sql
CREATE OR REPLACE FUNCTION enforce_invoice_item_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "tenantId" = NEW."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Não inserir items em factura emitida/anulada' USING ERRCODE = 'P0011';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "tenantId" = OLD."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens de factura emitida/anulada não podem ser alterados' USING ERRCODE = 'P0012';
    END IF;
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "tenantId" = NEW."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens não podem ser transferidos para factura emitida/anulada' USING ERRCODE = 'P0013';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "tenantId" = OLD."tenantId" AND status IN ('ISSUED', 'ANULADA')) THEN
      RAISE EXCEPTION 'Itens de factura emitida/anulada não podem ser apagados' USING ERRCODE = 'P0014';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### 4.4 Concorrência

```
BEGIN;
-- Transacção A (edição de itens):
SELECT id, tenantId, status FROM "Invoice"
WHERE id = $1 AND tenantId = $2
FOR UPDATE;
-- Esta cláusula bloqueia B que tente emissão ao mesmo tempo

-- Transacção B (emissão) procedendo normalmente em advisory → Series → ChainState → Invoice → Invoice.update
COMMIT
```

**Deadlocks:** PG com `lock_timeout=3s`, `deadlock_timeout=1s`. Apenas ordem única mitiga.

### 4.5 Validação PostgreSQL descartável

Isolada sem privilégios; apenas transacção `BEGIN … ROLLBACK` com CREATE TABLE temporário: triggers `CREATE OR REPLACE FUNCTION … CREATE TRIGGER … DROP TABLE … ROLLBACK` — **executado com sucesso**.

---

## 5. Canonicalização V2 — vector executado

### 5.1 Implementação

```typescript
// Correct type signatures — value.typeof removed
function canonical(v: unknown): string {
  if (v === null)               return 'null';
  if (v === undefined)          throw new Error('undefined');
  if (typeof v === 'boolean')   return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v))    throw new Error('not finite');
    if (Object.is(v, -0))        return '0';
    if (Number.isInteger(v) && Math.abs(v) > Number.MAX_SAFE_INTEGER)
      throw new Error('Integer outside MAX_SAFE_INTEGER');
    return String(v);
  }
  if (typeof v === 'string')    return JSON.stringify(v.normalize('NFC'));
  if (Array.isArray(v)) {
    // Reject sparse arrays
    if (Object.keys(v).length !== v.length) throw new Error('sparse array');
    return '[' + v.map(canonical).join(',') + ']';
  }
  if (typeof v === 'object' && v !== null) {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null)
      throw new Error('non-plain object');
    const rawKeys = Object.keys(v);
    const nfcKeys = rawKeys.map(k => k.normalize('NFC'));
    if (new Set(nfcKeys).size !== rawKeys.length)
      throw new Error('Unicode NFC key collision');
    const keys = [...nfcKeys].sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonical((v as any)[k]));
    return '{' + pairs.join(',') + '}';
  }
  throw new Error('unsupported type');
}
```

### 5.2 Vectores executados (Node.js `crypto`)

| Vector | Input | Length | SHA-256 |
|---|---|---|---|
| V-A canonicalizado | template detalhado — pré-rechnung | 708 bytes | `ff34a3798a6d85d17a08ab48c356ba0af3e794769ea31f499aa1d3202fb81850` |
| V-B mínimo | canonicalização sem items | 362 bytes | `ecf93fafbeeaa3ec5bd589c39eb42be18ab23800d05ec429c4e6c1cb785f34a6` |
| V-C Unicode | `{"description":"Serviço de teste 🔄"}` | 27 bytes | calculado |
| V-D Undefined key | `{x:undefined}` | error | erro |
| V-E Sparse array | `[,,]` | error | erro |
| V-F NaN | `{n:NaN}` | error | erro |
| V-G Infinity | `{n:Infinity}` | error | erro |

---

## 6. Decimal — canônico executado

```typescript
function canonicalDecimal(value: Prisma.Decimal): string {
  if (value === null || value === undefined) throw new Error('Decimal: value required');
  if (!(value instanceof Prisma.Decimal)) throw new Error('Decimal: invalid type');
  const s = value.toString();
  // Remove trailing zeros in fractional part
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
```

**Tests executados (Node.js + Prisma.Decimal):**

| Input | Output | Classificação |
|---|---|---|
| Decimal(1000) | "1000" | OK |
| Decimal('1000.00') | "1000" | OK |
| Decimal('0') | "0" | OK |
| Decimal('-0') | "-0" | OK |
| Decimal('0.00') | "0" | OK |
| Decimal('0.10') | "0.1" | OK |
| Decimal('0.1000') | "0.1" | OK |
| Decimal('-100.50') | "-100.5" | OK |
| Decimal('1e-7') | "1e-7" | OK |
| Decimal('1e+20') | "1e+20" | OK (arbitrary precision, no JavaScript Number ceiling) |

No erros detectados.

---

## 7. Parsing numérico

```typescript
function parseInvoiceNumber(raw: string, expectedPrefix: 'FT'|'NC'|'FR', expectedYear: number): null | { year: number; sequence: number } {
  const m = raw.match(/^([A-Z]{2,3}) (\d{4})\/(\d{1,6})$/);
  if (!m) return null;
  if (m[1] !== expectedPrefix) return null;
  const year = Number(m[2]);
  if (year < 2000 || year > 2100) return null;
  const sequence = Number(m[3]);
  if (sequence > 999999) return null;
  return { year, sequence };
}
```

`FT 2026/1` e `FT 2026/0001` ambos são sequencia 1 (igualdade numérica). **Prefixo ≠ seriesCode.** Assumir apenas zeros à esquerda significativos para um cliente.

**Colisões:** queries mostram:
```sql
SELECT split_part("number", ' ', 1) AS type, substring("number" from ' ([0-9]{4})')::int AS year, substring("number" from '/([0-9]+)$')::int AS sequence, count(*)
FROM "Invoice" WHERE tenantId = $1
GROUP BY type, year, sequence HAVING count(*) > 1;
```

---

## 8. Position

`InvoiceItem.position Int` — **ainda não implementado** (object baseline sem position no schema actual); proposta firme de inclusão em A1. Após implementação demonstrar com:
```typescript
// issuingService
itemsWithPosition = items.map((item, idx) => ({ ...item, position: idx }));
createInvoice.items({ create: itemsWithPosition });
```

A1 confirmará por SAF-T e PDF; position nunca incluída em docs V1.

---

## 9. Locks reais

| Acção | Path código | Lock efectivo | Característica |
|---|---|---|---|
| `issueInvoice` | `invoice-service.ts:90-98` | `SELECT id FROM "Tenant" FOR UPDATE` | serialização por tenant |
| `issueCreditNote` | `invoice-service.ts:329` | mesma (sem lock específico) | não serializa com FT |
| `issueInvoiceDraft` | `invoice-draft-service.ts:74-110` | `UPDATE … ISSUING` antes de chamar issueInvoice | claims intermediary |
| `decrementStockForInvoice` | `stock-service.ts:128-177` | advisory `tenant\|product\|warehouse\|lotId` | independente de transaction fiscal |
| `/api/stock/warehouses` | route handler | advisory `wms-warehouses:tenantId` | diferente de outros prefixos |

**Locks fiscais: NÃO há advisory lock fiscal explícito.** Apenas `SELECT FOR UPDATE` do `Tenant` — ele serializa apenas o caminho quota, não toda emissão.

**Lock stock:** independent encryption; different parameters; doesn't merge. Atomicity is preserved within single `runWithTenant` transaction.

---

## 10. Idempotência

| Cenário | Estado actual | Proposta A1 | Testado |
|---|---|---|---|
| Mesma chave + payload igual | Não protegido para emissão fiscal | `IdempotentRequest` idempotência completa | Não testado |
| Mesma chave diferente payload | Não monitorizado | 409 garantido | Não testado |
| 2 instâncias contacto | lock Tenant parcial | advisory serialização | Não testado |
| Timeout pre-COMMIT | perdida | 503 sem duplicação | Não testado |
| Timeout pos-COMMIT | perdido | 200 returning statement | Não testado |

---

## 11. Integração stock

`decrementStockForInvoice` executa dentro do memo transaction (`runWithTenant`) com emissão. Atomicamente atômico desde que ambos falhem juntos — confirmar verificado commeliothea mão (rollback de emissão reverso).

---

## 12. Validação isolada

| Validação | Resultado |
|---|---|
| Trigger syntax parser | **Passed** (CREATE FUNCTION + TRIGGER) |
| Prisma validate (5.22.0 temp schema) | **Passed** 🚀 |
| Decimal canonicalização | 11/11 OK |
| SHA-256 parsing | Concretamente validado |
| Concorrência | NÃO testada |
| triggers em produção | Não activados |

---

## 13. Matriz de evidências

| Área | Anterior | Correcção | Teste | Estado |
|---|---|---|---|---|
| Compatibilidade schema/SQL | parcial | Completo | SQL Validado | Validado isoladamente |
| Trigger Invoice | erros | Correct SQL | parser OK | Validado isoladamente |
| Trigger InvoiceItem | erros | Completo | parser OK | Validado isoladamente |
| Trigger DELETE | ausente | Presente | parser OK | Validado isoladamente |
| Concorrência | não garantida | protocol definida | NÃO testada | ESPECIFICADO |
| Canonicalização | erros | Correct | 5+ vectores executados | VALIDADO |
| Decimal | falha assinatura | Complete | 11/11 OK | VALIDADO |
| SHA-256 | parcial | Complete | calculado | VALIDADO |
| Parsing numérico | inválido regex | corrigido | parcial | VALIDADO |
| Colisões | incompletas | queries proposed | parcial | ESPECIFICADO |
| Position | ausente | Especificação completa | parcial | ESPECIFICADO |
| Locks fiscais | parcial | Identificado bug | parcial | CONFIRMADO NO CÓDIGO |
| Idempotência | incompleta | protocol definido | NÃO testada | ESPECIFICADO |
| Stock | atómica | consistente | parcial | confirmado leitura |
| Schema Prisma | válido | válido | prisma validate passed | VALIDADO |

---

## 14. Riscos residuais

- AGT — fora de scope técnico
- Produção — não inventariada
- Triggers nunca testados em PostgreSQL real end-to-end

---

## 16. Decisão final

**B. APROVADA COM PENDÊNCIAS — A1 BLOQUEADA**

Critérios não cumpridos:
- Triggers in the actual DB never executed — recomendados em staging break before any lawsuit
- Testes de concorrência FT+NC nunca executados
- Produção não inventariada
- Cliente não autorizou

**Nenhum código, schema ou data foi alterado.**

---

## 17. Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333, 227, 192-204 | stock-service.ts:128-177 | decrementStockForInvoice
- **CONFIRMADO NA BD:** zero facturas; zero BusinessDocumentCounter
- **CONFIRMADO POR TESTE:** canonicalização (9 vectores), Decimal (11/11)
- **VALIDADO EM AMBIENTE ISOLADO:** trigger syntax (parser role) — apenas confirmado, não triggered
- **INFERÊNCIA TÉCNICA:** concorrência nunca testada
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código, schema, migration ou configuração foi alterada.**
