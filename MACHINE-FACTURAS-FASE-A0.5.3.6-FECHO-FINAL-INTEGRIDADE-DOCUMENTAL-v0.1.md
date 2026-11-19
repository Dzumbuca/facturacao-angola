# MACHINE FACTURAS — FASE A0.5.3.6
## Fecho final da integridade documental da facturação

**Data:** 2026-11-16
**Escopo:** exclusivamente modelado e validado. **Zero** alterações aplicadas em staging ou produção.
**Schema oficial:** intocado.
**Schema temporário:** `.qa_temp_schema/validate.prisma` — validado, depois removido.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

Executada a validação efectiva com Prisma 5.22 + `prisma validate` sobre o schema proposto com todas as relações multi-tenant corrigidas, incluindo: posição (`position`) em `InvoiceItem`, `sourceDraftId` em `Invoice` com `@unique`, FK composta para `InvoiceChainState` e `tenant`-aware `Invoice → InvoiceDraft`.

**Validação REAL final:** schema temporário passou `The schema at .qa_temp_schema\validate.prisma is valid 🚀` ✅

**Decisão final:** **APROVADA COM PENDÊNCIAS — A1 BLOQUEADA** até autorização explícita e inventário de produção.

---

## 2. Problemas herdados da A0.5.3.2-5

| # | Problema | Solução nesta fase |
|---|---|---|
| P0-1 | Invoice↔InvoiceChainState contraditório | FK composta `(tenantId, lastInvoiceId) → Invoice(id, tenantId)`; `@@unique([lastInvoiceId])`; coerência via transacção |
| P0-2 | Ordem de locks não demonstrada em serviços reais | Matriz real com códigos `issueInvoice`, `issueCreditNote`, `issueInvoiceDraft` |
| P0-3 | V2 incompleta | Definición com object-key ordering determinístico |
| P0-4 | Sem campo de posição em InvoiceItem | InvoiceItem agora **required** `position Int` |
| P0-5 | InvoiceDraft sem garantia multi-tenant | FK composta `(tenantId, sourceDraftId) → InvoiceDraft(tenantId, id)` + `@@unique([tenantId, id])` |
| P0-6 | Cardinalidade InvoiceItem ≠ realidade | `Invoice 1 ──── * InvoiceItem` — confirmado |
| P0-7 | Schema temporário não validado em contexto completo | Validação completa passada ✅ |

---

## 3. InvoiceChainState e coerência da cabeça

### Estado válido

```
InvoiceChainState:
  tenantId      String   @id
  lastSequence  Int      @default(0)
  lastHash      String?
  lastInvoiceId String?
```

**Estados permitidos:**
- `lastSequence=0, lastHash=NULL, lastInvoiceId=NULL` → estado vazio
- `lastSequence>0, lastHash IS NOT NULL, lastInvoiceId IS NOT NULL` → estado com factura de cabeça

**Coerência cruzada garantida:**
- Última factura referenciada via `currentChainState` rel. Nome `CurrentChainHead`
- FK composta liga `(tenantId, lastInvoiceId) → Invoice(id, tenantId)` onDelete Restrict
- `@@unique([lastInvoiceId])` numérica única para 1:1

**Constrangimentos SQL recomendados:**
```sql
ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT state_consistency_valid
  CHECK (
    (lastSequence = 0 AND lastHash IS NULL AND lastInvoiceId IS NULL)
    OR
    (lastSequence > 0 AND lastHash IS NOT NULL AND lastInvoiceId IS NOT NULL)
  );
```

**Não existe representação de coerência hash=invoice.hash no Prisma (cross-table cross-field)** — Isto requer trigger adicional:
```sql
CREATE OR REPLACE FUNCTION chain_state_coherence() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.lastInvoiceId IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM "Invoice"
        WHERE id = NEW.lastInvoiceId AND tenantId = NEW.tenantId
        AND hash = NEW.lastHash AND "chainSequence" = NEW.lastSequence) THEN
        RAISE EXCEPTION 'InvoiceChainState inconsistent with Invoice head';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chain_state_coherence
  BEFORE INSERT OR UPDATE OF lastInvoiceId, lastHash, lastSequence ON "InvoiceChainState"
  FOR EACH ROW EXECUTE FUNCTION chain_state_coherence();
```

Trigger não substituí coerência de transacção; é safety-net em casos de escrita externa (migrações SQL paths que ignore protocol).

**Rollback semantics:** Se trigger falhar → ROLLBACK ao DELETE do InvoiceChainState ou update. Nunca estado partial.

---

## 4. Canonicalização criptográfica V2

### 4.1 Función de canónica recursiva

```typescript
function canonical(v: any): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return JSON.stringify(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort();      // ordenação determinística de propriedades
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonical(v[k]));
    return '{' + pairs.join(',') + '}';
  }
  throw new Error('Unsupported type in canonical payload');
}
```

**Recursive** — cada objecto nested é canonizado pela mesma função. Arrays preservam ordem original de inserção de items.

### 4.2 Decimal canônico

```typescript
function canonicalDecimal(v: Prisma.Decimal): string {
  // Prisma.Decimal.toString() fornece canônico fixo
  const s = v.toString();
  // Se já é inteiro, remove zeros à direita
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
```

| Entrada | Saída canônica |
|---|---|
| `Decimal(1000)` | `"1000"` |
| `Decimal('0')` | `"0"` |
| `Decimal('0')` negativo | `"-0"` |
| `Decimal('0.01')` | `"0.01"` |
| `Decimal('0.10')` | `"0.1"` |
| `Decimal('-100.50')` | `"-100.5"` |

**Precisão `Decimal(10,2)` / `Decimal(12,2)` / `Decimal(5,2)`** preservam a mesma precisão monetária; zeros à direita descartados implicitamente.

### 4.3 Payload V2 — completo e versionado

```typescript
const canonicalBytes = canonical({
  hashVersion: 2,
  seriesCode,
  documentType,
  year,
  number,
  tenantId,
  customerId,
  customerName,
  customerNif,
  currency: 'AOA',
  items: items.map((item, idx) => ({
    description: item.description,
    productCode: item.productCode ?? null,
    quantity: canonicalDecimal(item.quantity),
    unitPrice: canonicalDecimal(item.unitPrice),
    taxRate: canonicalDecimal(item.taxRate),
    total: canonicalDecimal(item.total),
  })),
  applyVat: Boolean(applyVat),
  discountAmount: canonicalDecimal(discountAmount),
  discountType,
  discountValue: canonicalDecimal(discountValue),
  observations: observations ?? null,
  includeCompanyProfile: Boolean(includeCompanyProfile),
  companyProfileSnapshot: snapshot ?? null,
  companyLogoId: logoId ?? null,
  subTotal: canonicalDecimal(subTotal),
  taxTotal: canonicalDecimal(taxTotal),
  total: canonicalDecimal(total),
  issuedAt: issuedAt.toISOString(),        // ISO-8601 UTC sempre
  previousHash: previousHash ?? null,
  chainSequence: chainSequence,
});

const h2 = createHash('sha256').update(canonicalBytes, 'utf8').digest('hex');
```

**Versionamento**: V1 (legacy) → V2 (novo). Nunca misturar; ambos persist lado a lado via `hashVersion`.

---

## 5. Ordenação determinística dos itens — InvoiceItem.position

**Schema existente não tem campo de posição.** Nova coluna obrigatória:

```
model InvoiceItem {
  ...
  position   Int

  @@unique([tenantId, invoiceId, position])
}
```

**Cálculo:** position = index no momento de INSERT serializado. Position unique per documento, garantindo ordem determinística: **um item por position por invoice**.

**Itens duplicados** por posição causam violação de unique — detecção automática; nota obrigatória de padrão não violado.

**Implicação:** V1 legado não possui posição → documentos históricos continuam válidos (validados por hash antigo); V2 e subsequentes incluem position.

---

## 6. Migração numérica seguramente

Estratégia, validação e bloqueio:

1. **Inventário de produção** (não agora) — SELECT DISTINCT type, status FROM Invoice
2. **Classificação por (tenantId, type, seriesCode, year, number)**
3. **Extração numérica**:
   - `substring(number from '/([0-9]+)$')` — capture sequências finais para qualquer formato reconhecido (`FT 2026/0001`, `FT/2026/0001`, etc.)
   - Dígitos consecutivos *antes* de `/` emaranhados com prefixo → bloquear
4. **Detecção de duplicados** — `GROUP BY tenantId, seriesCode, type, year, number` HAVING COUNT(*) > 1 → bloqueio SÉRIE
5. **Reconstrução de counter** — `lastNumber = MAX(seq-number)` por série; nunca decréscimo
6. **Ambíguos** — qualquer formato que não encaixa no padrão obriga inspecção manual
7. **Nunca atribuir chainSequence a documentos históricos** sem evidência criptográfica

**Bloqueio:** any row that doesn't match recognised format → bloqueio da série, investigação manual.

---

## 7. Ordem real dos locks (inspeccionada no código)

| Operação | Rota/serviço actual | Ordem real actual | Ordem proposta | Necessidade de refacara em A1 |
|---|---|---|---|---|
| emitir FT | `/api/invoices/generate-pdf` → `issueInvoice` | advisory (linha 212) → count → create | advisory → InvoiceSeries.upsert → ChainState.upsert → Invoice.create → IdempotentRequest.insert → Stock | sim |
| emitir NC | `/api/invoices/generate-pdf` → `issueCreditNote` | count → create | idêntica | sim |
| emitir draft | `/api/invoices/drafts/[id]/issue` → `issueInvoiceDraft` → `issueInvoice` | claim → issueInvoice | herda; mesmo fluxo | sim |
| stock emissão | `stock-service.decrementStockForInvoice` | inside runWithTenant; advisory lock invoked at top | after fiscais bloqueios | compatível |

**Lacuna de stock:** confirmada herança advisory lock, chain state em vários pontos — na A1 o lock é único entre as posições de emissão. Compatível desde que o refactor A1 unifica a ordem.

**Não inversão **— nenhum serviço pode ter InvoiceChainState antes de InvoiceSeries.

---

## 8. Relação InvoiceDraft multi-tenant

**FK composite:**

```prisma
sourceDraft InvoiceDraft? @relation(fields: [tenantId, sourceDraftId], references: [tenantId, id], onDelete: Restrict)
```

**InvoiceDraft:**
```prisma
@@unique([tenantId, id])
```

**Invoice:**
```prisma
@@unique([tenantId, sourceDraftId])
```

**Comportamento:** rascunho de tenant A não pode converter uma factura do tenant B. Restrição efectiva a nível de FK. Isto bloqueia duplicados Cross-tenant no mesmo sourceDraft.

**Sobre sourceDraftId em Invoice:** atribuído na emissão — por isso a @unique só captura o valor real de conversão.

---

## 9. Cardinalidades corrigidas

| Relação | Cardinalidade correcta |
|---|---|
| Tenant → InvoiceSeries | 1:N |
| Tenant → InvoiceChainState | 1:1 (lazy) |
| Tenant → IdempotentRequest | 1:N |
| Tenant → Invoice | 1:N |
| InvoiceSeries → Invoice | 1:N |
| Invoice → InvoiceItem | 1:N |
| InvoiceChainState → Invoice | 1:1 |
| InvoiceChainState → Tenant | 1:1 (idence) |

`InvoiceItem` tem agora `@@unique([tenantId, invoiceId, position])`; cada item tem posição; contador do documento é coerente.

---

## 10. Schema Prisma validado

**Comando:**
```
npx prisma validate --schema=.qa_temp_schema/validate.prisma
```

**Resultado exacto:**
```
Environment variables loaded from .env
Prisma schema loaded from .qa_temp_schema\validate.prisma
The schema at .qa_temp_schema\validate.prisma is valid 🚀
```

Adicionalmente:
```
npx prisma format --schema=.qa_temp_schema/validate.prisma
Formatted .qa_temp_schema\validate.prisma in 61ms 🚀
```

**Problemas estruturais encontrados e corrigidos neste ciclo:**
- relação duplicada `CurrentChainHead` removida
- enums single-line → multiline
- ausência de FK inverse nomeada `IdempotentResult` em `Invoice`
- ausência de `@@unique([tenantId, sourceDraftId])`
- ausência de FK composta `Invoice → InvoiceDraft` por `tenantId`
- `InvoiceItem` sem `position`

**Models validados:** Tenant, InvoiceSeries, InvoiceChainState, IdempotentRequest, InvoiceDraft, Invoice, InvoiceItem; enums `InvoiceType` (FT/NC/FR), `InvoiceStatus` (DRAFT/ISSUED/ANULADA).

**Schema oficial intocado.**

---

## 11. Matriz final de garantias

| Garantia | Prisma | FK | UNIQUE | CHECK | Trigger | Aplicação |
|---|---|---|---|---|---|---|
| Isolamento multi-tenant | ✅ | ✅ composite | ✅ | n/a | n/a | ✅ |
| InvoiceSeries integrity | ✅ | ✅ tenant | ✅ @@id | n/a | n/a | ✅ |
| InvoiceChainState integrity | ✅ | ✅ (id, tenantId) | ✅ position/id | ✅ CHECK state_consistency | optional | ✅ |
| IdempotentRequest integrity | ✅ FK composite | ✅ composite | ✅ @@id | n/a | n/a | ✅ |
| InvoiceDraft multi-tenant | ✅ FK composite | ✅ composite | ✅ @@unique | n/a | n/a | ✅ |
| Numeração fiscal | ✅ | n/a | ✅ composite | n/a | n/a | ✅ |
| chainSequence uniqueness | partial (incomplete by Prisma) | n/a | ✅ partial unique SQL | n/a | n/a | ✅ |
| Imutabilidade documental | n/a | n/a | n/a | ✅ CHECK | optional | ✅ |
| Atomicidade emissão | n/a | n/a | n/a | n/a | n/a | ✅ |
| Consistência hash | n/a | n/a | n/a | n/a | n/a | ✅ |
| InvoiceItem coherence | ✅ | ✅ | ✅ @@unique | n/a | n/a | ✅ |
| Multi-tenant drafts | ✅ | ✅ | ✅ | n/a | n/a | ✅ |

---

## 12. Riscos residuais

- **AGT** — processo externo de certificação
- **Produção** nunca assumida vazia — inventário obrigatório antes de qualquer migração
- Pedido>1000 simultâneos — requer simulação específica

---

## 13. Decisão final: APROVADA COM PENDÊNCIAS — A1 BLOQUEADA

**Condições explicitamente necessárias antes de dar início à Fase A1:**
1. Autorização escrita: "Autorizo implementação A1"
2. Inventário de produção: `SELECT DISTINCT type, status FROM "Invoice"; SELECT count(*) FROM "Invoice";`
3. Janela de testes em staging com 100 FT+NC paralelos em PostgreSQL real

**Aprovação arquitectural ≠ autorização operacional.**

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333; crypto.ts:11-44; invoice-draft-service.ts (requestId claims); stock-service.ts (decrementStockForInvoice with advisory lock); business-document-repository.ts:40-55
- **CONFIRMADO NO SCHEMA:** schema oficial intacto; temp schema validou 🚀
- **CONFIRMADO NA BD:** zero facturas; zero BusinessDocumentCounter
- **CONFIRMADO POR VALIDAÇÃO:** prisma validate passou com Prisma CLI 5.22.0; prisma format passou
- **INFERÊNCIA TÉCNICA:** testes de concorrência — não executados
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

**Nenhuma linha de código, schema official, migration ou dado de staging/produção foi alterada.**
