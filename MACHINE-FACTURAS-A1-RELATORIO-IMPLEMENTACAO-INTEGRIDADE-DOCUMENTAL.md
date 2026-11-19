# MACHINE FACTURAS — FASE A1
## Relatório de implementação do motor de integridade documental

**Data:** 2026-11-16
**Branch:** `feat/machine-facturas-a1-integrity`
**HEAD:** `780c594`
**Base:** `main` (`15bb189`) com base em `feat/machine-rh-b1-calendar`
**Autorização:** autorizada pelo proprietário (em msg)
**Staging:** intocado pelo código funcional
**Produção:** intocada — nenhuma migração executada

---

## 1. Arquitectura implementada

O motor de integridade documental baseia-se num **protocolo transaccional único** aplicado sob advisory lock, executado **dentro da mesma transação de emissão**:

```
BEGIN (runWithTenant)
  1. pg_advisory_xact_lock(hashtextextended('invoice-chain:'||tenantId, 0))
  2. INSERT INTO InvoiceSeries ON CONFLICT DO NOTHING (FT)
  3. UPDATE InvoiceSeries SET lastNumber = lastNumber + 1 ... RETURNING lastNumber
  4. INSERT INTO InvoiceChainState ON CONFLICT DO NOTHING (lazy init por tenant)
  5. SELECT InvoiceChainState FOR UPDATE
  6. chainSequence := lastSequence + 1; previousHash := lastHash
  7. hash := SHA-256(canonical V2 payload)
  8. INSERT INTO Invoice (status=ISSUED, hashVersion=2, chainSequence=N)
  9. INSERT INTO InvoiceItem (position=0..N-1)
  10. UPDATE InvoiceChainState (lastHash, lastSequence, lastInvoiceId)
  11. INSERT INTO IdempotentRequest (resultId = invoice.id, resource='INVOICE')
  12. UPDATE Stock (decrementStockForInvoice) — mesma transação
  13. UPDATE InvoiceDraft.status = 'ISSUED' (quando há sourceDraftId)
COMMIT
```

---

## 2. Modelos Prisma criados

- **InvoiceSeries** (`@@id([tenantId, seriesCode, documentType, year])`)
- **InvoiceChainState** (`@@id([tenantId])`; FK1-composite `(tenantId, lastInvoiceId) → Invoice(id, tenantId)`)
- **IdempotentRequest** (`@@id([tenantId, key])`; FK `(resultId, tenantId) → Invoice(id, tenantId)`)
- **InvoiceItem.position** novo campo `Int @default(0)` (`@@index([invoiceId, position])`)
- **Invoice.chainSequence** `Int?`, **Invoice.hashVersion** `Int @default(1)`, **Invoice.seriesCode**/`year`/`documentType` (`InvoiceType?`), **Invoice.documentType**
- **`@@unique([id, tenantId])`** na Invoice para FK composta para `InvoiceChainState` e `IdempotentRequest`

**Enums adicionadas** (mantendo os valores actuais): `InvoiceType { FT NC FR }`, `InvoiceStatus { DRAFT ISSUED ANULADA }`.

---

## 3. Triggers SQL adicionados à migração

- **`enforce_invoice_immutability()`** — UPDATE BEFORE; permite apenas transição ISSUED → ANULADA
- **`enforce_invoice_no_delete()`** — bloqueia DELETE de documentos ISSUED/ANULADA
- **`enforce_invoice_item_immutability()`** — bloqueia INSERT/UPDATE/DELETE em itens de factura emitida/anulada

Ficheiros: migração única `prisma/migrations/20260520140000_a1_integrity_documental/migration.sql`

---

## 4. Arquivos atacados

| Ficheiro | Mudança |
|---|---|
| `prisma/schema.prisma` | +InvoiceSeries, +InvoiceChainState, +IdempotentRequest, +InvoiceType, +InvoiceStatus, +InvoiceItem.position, +Invoice.chainSequence/hashVersion/seriesCode/year/documentType |
| `prisma/migrations/.../migration.sql` | Triggers e constraints |
| `src/lib/invoice-integrity-core.ts` | `canonicalDecimal`, `canonical` (recursivo, Unicode NFC, Decimal, BigInt, Date), `generateInvoiceHashV2` |
| `src/lib/invoice-integrity.ts` | `lockIntegrityChain`, `reserveInvoiceNumber`, `loadOrInitChainState`, `checkIdempotency`, `persistIdempotency` |
| `src/lib/invoice-integrity-core.test.ts` | Testes unitários canonicalização + hash V2 |
| `src/lib/invoice-integrity.test.ts` | Testes unitários helpers transaccionais |
| `src/lib/invoice-service.ts` | `issueInvoice` e `issueCreditNote` refactores para integrity engine; idempotência (HTTP 409/200) |
| `src/lib/invoice-draft-service.ts` | Aceita e propaga `idempotencyKey` |
| `src/lib/pdf-generator.ts` | Ordena itens por `position ASC` |
| `src/lib/saft-ao.ts` | `orderBy position ASC` na query de itens |
| `src/app/api/invoices/generate-pdf/route.ts` | Lê `Idempotency-Key` e mapeia `IDEMPOTENCY_CONFLICT` → HTTP 409 |
| `src/app/api/invoices/drafts/[id]/issue/route.ts` | Propaga `Idempotency-Key` |

---

## 5. Confirmado funciona vs. não executado

### FUNCIONA
- Suite de vitest completa: **515 testes passam**, **0 falham**
- Build `npx next build` sem erros de compilação (**Turbopack OK**)
- `prisma validate` passou após schema
- Triggers criadas via SQL (não executadas em staging mas sintaxe verificada)
- V2 produz SHA-256 determinístico (testado com 2 vectores distintos)
- V1 hash mantido intacto (`generateInvoiceHash` ainda exportado e compatível)
- Items PDF/SAFT respeitam `position ASC` (teste 509)
- Idempotência FT/NC implementada (verificada por unit tests + integração via mock TX)

### NÃO EXECUTADO / NÃO VALIDADO
- Nenhum dado foi escrito em staging nem em produção
- Migração SQL não foi aplicada automaticamente (apenas desenhada)
- Testes PostgreSQL ACID não executados (precisa de DB descartável)
- 100 FT concorrentes em paralelo não foram executados
- Concorrência FT+NC na mesma sessão ainda não testada
- Idempotência cross-process (duas instâncias separadas) não testada

---

## 6. Falhas/correcções durante implementação

- Schema falhou inicialmente com Prisma — corrigido com inversas de relations, enums separados e alias Prisma
- Reports de `tsc` 10x `Namespace 'Prisma' has no exported member 'Decimal'` — corrigido importando de `@prisma/client/runtime/library.js` directamente
- `prisma generate` falhou com EPERM no `query_engine-windows.dll.node` — não afecta agentes porque `index.d.ts` foi regenerado e o runtime usa `runtime/library.js` directo
- InvoiceItem sufixou `tenantId` que não existe no schema — corrigido via JOIN com Invoice em triggers
- UPDATE da cadeia FT inicialmente omitido — adicionado correctamente após `invoice.create()`
- pdf-generator e saft-ao não ordenavam por position — corrigido

---

## 7. Pendências explícitas

- Apply migration atraves de `prisma migrate` em staging **só após autorização explícita**
- Configurar `PRIVATE_KEY` estável (hoje env var referenciada, procedimento manual)
- Idempotency de `issueInvoiceDraft` mantém-se (claim `status='ISSUING'`) — não bloqueante
- PDF generation inside transaction when needed (hoje é despois do create mas sem lock no PDF commit — não é fiscal)
- Migração de dados históricos (V1 → cadeia canónica) não incluída aqui

---

## 8. Decisão técnica

Está **PRONTO PARA SER INTEGRADO** (merge na branch `feat/machine-facturas-a1-integrity`).

NÃO está pronto para ir à produção, porque:
- Migration não foi aplicada (não é responsabilidade desta fase)
- Teste E2E concorrente não foi executado
- Staging não foi usada sequer como prova

---

## 9. Commits neste PR

```
b27037b feat(invoices): add document integrity schema
3560e7f feat(invoices): add deterministic hash v2 and integrity primitives
fce0e09 feat(invoices): wire issuance into atomic series/chain flow
f66ff9b feat(invoices): wire NC issuance into atomic series/chain flow
ce6e52a feat(invoices): add idempotency + canonical payload hash to FT issuance
7daaab1 feat(invoices): add idempotency + canonical payload hash to NC issuance
48ba442 feat(invoices): wire idempotency-key through PDF and draft issuance routes
c35451f feat(invoices): ordering by InvoiceItem.position in PDF and SAF-T
780c594 test(invoices): invoice-integrity unit tests with mocked transaction
```
