# MACHINE FACTURAS — FASE A1.0
## Plano técnico de implementação da integridade documental

**Data:** 2026-11-16
**Natureza:** preparação de implementação. **Zero alterações** ao sistema actual.
**Staging:** read-only. **Produção:** intocada.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `0689a13`).

---

## 1. Estado actual do código

### 1.1 Caminhos de emissão fiscal existente

| # | Caminho | Ficheiro | Função | Documentos | Transacção | Estado |
|---|---|---|---|---|---|---|
| 1 | Emissão FT completa (gera-PDF rota) | `src/app/api/invoices/generate-pdf/route.ts` | `issueInvoice` | FT | `runWithTenant(tenantId, ...) { ... }` | Activo |
| 2 | Emissão de draft | `src/app/api/invoices/drafts/[id]/issue/route.ts` | `issueInvoiceDraft` → `issueInvoice` | FT | mesma `runWithTenant` seja dois runs **separados** (bug conhecido) | Activo |
| 3 | Emissão NC | `src/app/api/invoices/generate-pdf/route.ts` (cadeado) | `issueCreditNote` | NC | `runWithTenant` dentro da rota | Activo |
| 4 | Emissão directa via PDF | `generate-pdf` direct | `issueInvoice` | FT/NC condicional | mesma função | Activo |
| 5 | Nenhum caminho para FR | — | — | — | — | Não implementado |

**Pontos centralizados a integrar:**
- `src/lib/invoice-service.ts` → `issueInvoice` (criação central)
- `src/lib/invoice-service.ts` → `issueCreditNote` (criação NC)
- `src/lib/invoice-draft-service.ts` → `issueInvoiceDraft` (conversão)
- `src/app/api/invoices/generate-pdf/route.ts` → chama `issueInvoice` na forma actual
- `src/app/api/invoices/drafts/[id]/issue/route.ts` → chama `issueInvoiceDraft`
- `src/app/api/invoices/[id]/saft/route.ts` → `saft-ao.ts` lê dados (auditoria)

**stock:** `decrementStockForInvoice` dentro da mesma transacção Prisma `runWithTenant`. Stock já é atómico com emissão.

**stock locks:** advisory `tenantId|productId|warehouseId|lotId` — **DISTINTO** do modelo da emissão fiscal (não é `invoice-chain:tenantId`) e independente da issue.

**Stock limitations:** `stock-service.ts` invoca `$executeRaw` advisory para `wms-*` prefixos — **nunca** para `invoice-chain:*`.

---

## 2. Tipos documentais existentes

| Tipo | Aparece em | Notas |
|---|---|---|
| `FT` | `Invoice.type` = `"FT"` (default) | Factura única |
| `NC` | `Invoice.type` = `"NC"` | Nota de crédito via `issueCreditNote` |
| `FR` | **não usado** | Reservado no enum proposto |
| Outro | `BusinessDocument` (separado, não é Invoice) | Não tratado aqui |

**Importante:** InvoiceType e InvoiceStatus são `String` sem enum — migração necessária abordagem de enums.

---

## 3. Componentes novos a criar (revisar Secção A0.5.x.x)

### 3.1 InvoiceSeries

**Campos:**
```
tenantId     String
seriesCode   String     // e.g. "A"
documentType InvoiceType
year         Int
lastNumber   Int @default(0)
@@id([tenantId, seriesCode, documentType, year])
```

**Contadores independentes**: uma série A em 2026 pode chegar a 5000 e a série A em 2027 começa em 0.

**Inicialização concorrente:** `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE` dentro da transacção (já provado no A0.5.x.x).

**Actualização:** `UPDATE ... SET lastNumber = lastNumber + 1 WHERE ... RETURNING lastNumber` — atómica.

**Não usar `count(*)`.** Já confirmado no invoice-service.ts:93-97 (BUG).

### 3.2 InvoiceChainState

**Campos:**
```
tenantId       String @id
lastHash       String?
lastSequence   Int @default(0)
lastInvoiceId  String?
```

**FK composta por tenant:** `(lastInvoiceId, tenantId) → Invoice(id, tenantId)` onDelete `Restrict`.

**Estado inicial:** `{ zeroHash = NULL, sequence = 0, lastInvoiceId = NULL }`.

**Actualização:** atomicamente dentro da mesma transacção da emissão; último passo.

### 3.3 IdempotentRequest

**Campos:**
```
tenantId  String
key       String
resource  String // 'INVOICE' | 'CREDIT_NOTE'
payloadHash String
resultId  String // Invoice id
createdAt DateTime @default(now())
@@id([tenantId, key])
```

**Chave composta por tenant:** `(tenantId, key) → UNIQUE` constraint.

**FK composto para Invoice:** `(tenantId, resultId) → Invoice(id, tenantId)` onDelete `Restrict`.

**payloadHash:** sha256 hex de `canonical(canonicalPayloadV2)`.

### 3.4 InvoiceItem.position

**Campo:** `position Int` REQUIRED.

**Unique:** `@@unique([tenantId, invoiceId, position])`.

**Atribuição na criação:** índice do array (`0, 1, 2…`).

**Imutabilidade:** após `status = 'ISSUED'`, `position` imutável via trigger.

**Ordenação:** `ORDER BY position ASC` em todas as consultas.

---

## 4. Hash e canonicalização V2

### 4.1 V1 — preservada

```
hashV1 = sha256(JSON.stringify({
  customerName, customerNif, items, applyVat,
  discountAmount: Number(...), discountType, discountValue: Number(...),
  observations, includeCompanyProfile, companyProfileSnapshot, companyLogoId,
  subTotal: Number(...), taxTotal: Number(...), total,
  date: issuedAt.toISOString(),
  previousHash: previousHash || 'ROOT'
}))
```

**Documentos históricos V1 validam sempre com V1.** Nunca reescrever.

### 4.2 V2 — novo

```
function canonical(v): string  // recursivo, chaves NFC-ordenadas, UTF-8
function canonicalDecimal(v: Prisma.Decimal): string  // 14/14 cases OK

hashV2 = sha256(canonical({
  hashVersion: 2,
  tenantId, seriesCode, documentType, year, number,
  customerId, customerName, customerNif, currency,
  items: items.map(i => ({
    position: i.position, description: i.description, productCode: i.productCode ?? null,
    quantity: canonicalDecimal(i.quantity),
    unitPrice: canonicalDecimal(i.unitPrice),
    taxRate: canonicalDecimal(i.taxRate),
    total: canonicalDecimal(i.total),
  })),
  applyVat, discountAmount, discountType, discountValue,
  observations, includeCompanyProfile, companyProfileSnapshot, companyLogoId,
  subTotal, taxTotal, total,
  issuedAt: iso8601Zulu,
  previousHash,
  chainSequence,
}))
```

**V1 ↔ V2 dispatcher:** pela coluna `hashVersion` no documento; nunca por heurística.

---

## 5. Imutabilidade — triggers propostos

```sql
-- Invoice
CREATE OR REPLACE FUNCTION invoice_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED','ANULADA') AND (
    NEW."tenantId"      IS DISTINCT FROM OLD."tenantId"
    OR NEW.type           IS DISTINCT FROM OLD.type
    OR NEW.number         IS DISTINCT FROM OLD.number
    OR NEW."subTotal"     IS DISTINCT FROM OLD."subTotal"
    OR NEW.total          IS DISTINCT FROM OLD.total
    OR NEW."taxTotal"     IS DISTINCT FROM OLD."taxTotal"
    OR NEW."previousHash" IS DISTINCT FROM OLD."previousHash"
    OR NEW.hash           IS DISTINCT FROM OLD.hash
    OR NEW."issuedAt"     IS DISTINCT FROM OLD."issuedAt"
  ) THEN
    RAISE EXCEPTION 'Documento emitido não pode ser alterado' USING ERRCODE = 'P0002';
  END IF;
  IF OLD.status = 'ISSUED' AND NEW.status = 'ANULADA' THEN RETURN NEW; END IF;
  IF OLD.status = 'ISSUED' AND NEW.status <> 'ISSUED' THEN
    RAISE EXCEPTION 'ISSUED só TRANSITA para ANULADA' USING ERRCODE = 'P0005';
  END IF;
  IF OLD.status = 'ANULADA' THEN
    RAISE EXCEPTION 'Documento anulado imutável' USING ERRCODE = 'P0006';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- InvoiceItem
CREATE OR REPLACE FUNCTION invoice_item_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Invoice" WHERE id = COALESCE(NEW."invoiceId", OLD."invoiceId") AND status IN ('ISSUED','ANULADA')) THEN
    RAISE EXCEPTION 'Item de factura emitida/anulada não pode ser alterado' USING ERRCODE = 'P0011';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- DELETE em Invoice
CREATE OR REPLACE FUNCTION invoice_no_delete() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('ISSUED','ANULADA') THEN
    RAISE EXCEPTION 'Factura emitida/anulada não pode ser eliminada' USING ERRCODE = 'P0004';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

**Triggers verificados em tabelas temporárias** — passarão quando os campos propostos existirem.

---

## 6. Protocolo transaccional (A1 completo)

```
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0));
-- Verificação idempotente TRANSSACTIONAL
SELECT resultId FROM "IdempotentRequest" WHERE tenantId = $1 AND key = $2;
  – Existe + payloadHash igual → rollback, devolve documento (HTTP 200)
  – Existe + payloadHash diferente → HTTP 409
  – Não existe → continua
INSERT INTO "InvoiceSeries" ON CONFLICT DO NOTHING;
SELECT FOR UPDATE FROM "InvoiceSeries" WHERE tenantId=$t AND seriesCode=$s AND documentType=$d AND year=$y;
chainSequence := lastSequence + 1;
previousHash := lastHash;
hash := sha256(canonical(...));
INSERT INTO "Invoice" ...
UPDATE "InvoiceChainState"
INSERT INTO "IdempotentRequest" (resultId = invoice.id)
UPDATE stock (decrementStockForInvoice) — dentro da mesma transação
COMMIT;
```

---

## 7. Estratégia de migração (proposto, NÃO EXECUTADO)

```sql
-- Inventário (produção read-only, obrigatório antes de qualquer migração)
SELECT type, status, count(*) FROM "Invoice" GROUP BY 1, 2;

-- Detecção de duplicados (por tenant)
SELECT "tenantId", type, substring("number" from ' ([0-9]{4})')::int AS year,
       substring("number" from '/([0-9]+)$') AS seq, count(*)
FROM "Invoice"
WHERE "number" ~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$'
GROUP BY 1,2,3,4
HAVING count(*) > 1;
```

**Ambíguos:** bloqueio da série; nunca auto-prosseguir.

**Backfill:** `InvoiceSeries.lastNumber = MAX(sequence extraída)` por grupo `(tenantId, prefix, year, type)`.

**Rollback:** snapshot + stop-on-error.

---

## 8. Matriz de testes A1 (parcial especificada)

| # | Teste | Tipo |
|---|---|---|
| T1 | Emissão FT — sucesso | Integração |
| T2 | 100 FT paralelos | Concorrência |
| T3 | FT + NC paralelos mesma cadeia | Concorrência |
| T4 | Mesma chave idempotente simultânea | Idempotência |
| T5 | Chave + payload diferente | HTTP 409 |
| T6 | Timeout pré COMMIT | 503 |
| T7 | Timeout pós COMMIT | 200 e documento igual |
| T8 | Stock insuficiente → rollback completo | Atomicidade |
| T9 | Falha stock → rollback Invoice | Atomicidade |
| T10 | Draft emissão concorrente × 2 | Claim ISSUING |
| T11 | Verificar V1 hash compatibilidade | Regressão |
| T12 | Verificar V2 hash emitidos | Integração |
| T13 | Transferência de itens | Imutabilidade |
| T14 | SAFT com novos documentos | Compliance |
| T15 | SAFT histórico | Regressão |
| T16 | Trigger emite muita carga | Performance |
| T17 | Rollback por impostos falsos | Stock ↔ Invoice |
| T18 | Falha Supabase | Visibility |

---

## 9. Subfases propostas

Dependendo da decisão do utilizador:

| Subfase | Duração estimada | Risco |
|---|---|---|
| A1.1 — Schema + migrations | 1-2 dias | Baixo |
| A1.2 — InvoiceSeries | 1 dia | Médio (update-a-atomic) |
| A1.3 — InvoiceChainState | 1 dia | Médio (cross-tenant FK) |
| A1.4 — Canonicalização V2 + hash binding | 2-3 dias | Baixo (testes ok) |
| A1.5 — Idempotência | 1 dia | Baixo |
| A1.6 — Imutabilidade + triggers | 1 dia | Médio (SQL validado) |
| A1.7 — Migração staging | 2-3 dias | Alto (dados reais) |
| A1.8 — Testes utils e concorrência | 2-3 dias | Alto |
| A1.9 — Rollout (com fallback) | 1 dia | Alto |
| A1.10 — Migração produção | Planejada após A1.9 | Crítico |

---

## 10. Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| `type`/`status` String sem enum | fricção migration | enum type migration |
| Produção com dados inconsistentes | bloqueio fase | inventário read-only separado |
| Hash V1≠V2 concorrência | audit dispute | hashVersion per-document |
| `transaction.invoice.count` existente | performance | `InvoiceSeries` substitui |
| Draft emission OR ISSUING (dois runs) | race | revisão específica de `issueInvoiceDraft` |
| `sourceDraftId` como único identificador único | falha de chamada unique | conceito de "emissão duas vezes" |
| DecrementStock paralelo | deadlock | locked-by-default estritamente |

---

## 11. Decisions from declaração do utilizador

1. **A1 autoriza-se?** Pendente — autorização expressa necessária
2. **Data de início?** Pendente
3. **Autorização para staging migration?** Pendente
4. **Cronograma e janela com downtime?** Pendente
5. **Ambiente de produção?** Pendente de autorização específica
6. **AGT certificado?** Ofuscamento separado

---

## 12. Ficheiros a alterar (enumeration)

| Ficheiro | Acção |
|---|---|
| `prisma/schema.prisma` | Adicionar 3 modelos + 2 enums |
| migrations | 1 migration with SQL triggers |
| `src/lib/crypto.ts` | Add `generateInvoiceHashV2()` |
| `src/lib/invoice-service.ts` | Refactor `issueInvoice`, `issueCreditNote` |
| `src/lib/invoice-draft-service.ts` | Revise idempotência cross-transaction |
| `src/lib/tenant-db.ts` | Verify atomicity options |
| `src/lib/stock-service.ts` | Verified compatible; update advisory lock name |
| `src/app/api/invoices/drafts/[id]/issue/route.ts` | Integrar novo protocolo |
| `src/app/api/invoices/generate-pdf/route.ts` | Integrar novo protocolo |
| `src/lib/saft-ao.ts` | Update toV2 when hashVersion=2 |
| `src/lib/pdf-generator.ts` | Sort by position ASC |
| `src/lib/tax.ts` | Tax fields (unchanged) |
| Testes | New test files for each subfase |

---

## 13. Decisão final

**B. APROVADA COM PENDÊNCIAS — A1 BLOQUEADA.**

Bloqueadores antes da implementação real:

1. Autorização escrita para iniciar A1
2. Inventário de produção (SELECT DISTINCT type, status FROM "Invoice")
3. Janela de concorrência em staging
4. Triggers activados em staging end-to-end
5. AGT certificado (externo)

**Nenhum código, schema, migration, configuração ou dado foi alterado.**
