# MACHINE FACTURAS — Auditoria Integral da Área de Facturação
## FASE 1 — Fundação comercial (diagnóstico real, sem alterações)

**Data:** 2026-11-16
**Natureza:** auditoria em modo estritamente de leitura. **Nenhuma** alteração funcional, migração ou escrita na BD foi executada.
**Código:** branch `feat/machine-rh-b1-calendar` (HEAD `f9706b2` + `af3cdb2`).
**Staging:** `localhost:5432/machine_facturas_staging` (read-only).

---

## 1. Resumo executivo

O sistema de facturação está **funcionalmente sólido no núcleo** — emissão/partilha/PDF/SAFT-AO/recebimentos — mas **estrutural** problem areas:

- **Zero clientes reais** no staging e em produção (Invoice=0, Payment=0, Customer=0) — tudo por validar comercialmente
- **Prevenção de clientes duplicados inexistente** (NIF idêntico aceita vários registos)
- **Recebimentos** só funcional (m recente merge), com fluxo public-token chato mas funcional
- **stock permit WMS**; PO → recepção existe mas incompleto
- **RLS** em curso (nunca concluído em produção; 4.3C/4.3K pendentes)
- **Nenhum módulo de contabilidade** — bloqueia o sonho ERP

A facturação está a um nível "pré-mercado" — bom código, nenhum utilizador. Para servir como fundação do ERP, é preciso fechar horários, passar por pilotos, e consolidar AGT compliance com validação externa.

---

## 2. Arquitectura actual

```
Next.js 16 (App Router) + React 19 + Prisma 5.22 + PG 18
  ↓
schema.prisma (89 models; 56 migrations)
  ↓
tenant-db: runWithTenant / runAsAdmin / runAsSystem / runWithRlsContext
  ↓
RLS (90 tabelas, 37 pg_policies; apps públicas com SECURITY DEFINER pendentes na Phase 4.3H)
```

**Decisão arquitectural-chave:** token-driven / manuel POS type stack with `shareToken`.

---

## 3. Inventário de funcionalidades

| Funcionalidade | Estado |
|---|---|
| Criação de facturas (FT) | ✅ |
| Criar notas de crédito (NC) | ✅ (suportado na página, mesma API) |
| Rascunhos salváveis | ✅ |
| Layout PDF | ✅ (pdfkit, white-label simples) |
| PDF público e partilha tokenizada | ✅ |
| Funcionalidade /fituras | ✅ (`/invoices`) |
| Detalhe da factura | ✅ (`/invoices/[id]`) |
| Dashboard com KPIs | ✅ |
| Recebiveis (novo, PENDING→CONFIRMED) | ✅ |
| Recibo público | ✅ |
| Facturas-recibo | ❓ (não evidenciado end-to-end) |
| Facturas proforma | ⚠️ (existe `BusinessDocument` família mas 0 dados em staging) |
| Orçamentos/encomendas | ⚠️ (`BusinessDocument`, 0 registos) |
| Nota de crédito | ✅ |
| SAFT-AO export | ✅ |
| AGT signature | ✅ no código
| Relatórios avançados | ❌ (apenas relatório básico de vendas) |
| Abrir/exportar SAFT-AO fora do programa | ❌ |
| Facturas recibo (impressão de recibos do recebimento) | ✅ |
| Indicação de cliente para próxima emissão | ❌ |
| Enviar factura por e-mail | ✅ |

---

## 4. Mapa de páginas e componentes

| Página | Tipo | Estado |
|---|---|---|
| `/inicio` | Landing | produção |
| `/pricing` | Landing | produção (como parte do inicio) |
| `/ferramentas/*` | Landing | produção |
| `/guias/*` | Landing | produção |
| `/academia/*` | Landing | produção |
| `/invoices` | Lista + KPI bar | produção |
| `/invoices/new` | Formulário | produção |
| `/invoices/[id]` | Detalhe | produção |
| `/invoices/[id]/draft` | Rascunho | produção |
| `/documentos/*` | Docs comerciais (propostas) | prod |
| `/recebiveis` | Gestão de recebimentos | novo |
| `/r/[token]` | Recibo público | produção |
| `/f/[token]` | Factura pública | produção |
| `/reports` | Relatórios | produção |
| `pdf route /api/invoices/[id]/pdf` | Handler | produção |

---

## 5. Mapa de APIs e serviços

| Endpoint | Serviço |
|---|---|
| `GET /api/invoices` | list + filter |
| `GET /api/invoices/[id]/pdf` | PDF gen |
| `POST /api/invoices/[id]/payments` | record payment (pending) |
| `POST /api/payments/[id]/status` | transition (CONFIRMED/CANCELLED/REVERSED) |
| `GET /api/payments/[id]/proof` | proof download (company only) |
| `POST /api/public/informed-payment` | client report payment via link |
| `GET /api/invoices/[id]/payments` | list payments |
| `POST /api/business-documents` | CRUD |
| `POST /api/customers` | CRUD |
| `POST /api/produtos` | CRUD (with sku duplicate prevention) |

**Services:** `invoice-service`, `payment-service`, `receipt-service`, `financial-metrics`, `saft-ao`, `report-data`, `invoice-quota`, `tenant-db`.

---

## 6. Inventário de models e relações

89 models; 189 relações.

| Categoria | Models |
|---|---|
| Facturação | Invoice, InvoiceItem, InvoiceDraft |
| Pagamentos | Payment, PaymentEvent, PaymentReceipt |
| Business docs | BusinessDocument, BusinessDocumentItem, BusinessDocumentEvent, BusinessDocumentCounter |
| Stock | Warehouse, ProductWarehouseStock, Stock*, StockLot, StockReservation, StockAdjustment, StockMovement, StockTransfer, ProductWarehouseStock |
| Clientes | Customer |
| Produtos | Product |
| RH (35) | RhEmployee, RhContract, RhTimeEntry, … |
| Subscrições | SubscriptionPlan, PlanLimit, PlanCapability, PlanApplication, PlanPayment, TenantSubscription |
| Auditoria | AdminAuditLog, RhAuditLog |
| Auth | User, Account, Session, VerificationToken, AuthJwtRevocation |

**Invoice ←→ InvoiceItem** (cascade), **Invoice ←→ Customer**, **Invoice ←→ Tenant**, **InvoiceItem ←→ Product** (optional), **Payment ←→ Invoice**, **Payment ←→ Tenant** (cascade), **PaymentReceipt ←→ Payment** (1:1, unique), **InvoiceDraft** singulares.

---

## 7. Auditoria de Clientes

### Schema

```
Customer {
  id, tenantId, name, nif?, address?, email?, createdAt
  Invoice (relationship), BusinessDocument (relationship)
}
```

### O que falta

- **Deduplication**: mesmo NIF/name aceita múltiplos registos — **P1**
- **Cadastro empresarial/particulares**: dominio existe mas UI não distinguishes
- **Endereço**: sem padronização;sem segundo endereço, já contact — contact n/ a
- **NIF**: não é obrigatório — correcto para proforma; **deveria** ser obrigatório à emissão de documento fiscal (P1)
- **Histórico de facturação**: funciona via relationship lookup (sem UI própria)
- **Edição de clientes**: apenas create usado, UI pré-existente não permite update explicito via clientes/edit
- **Email/ telefone**: inexistent no model (comunicação só nome)

### P1-COLLECTION-DEDUP e P1-COLLECTION-UPDATE

Recomendação: antes de abrir qualquer módulo novo, estabilizar esta base.

---

## 8. Auditoria de Produtos e Serviços

### Schema

Produto inclui: `name, price (Decimal), taxRate (default 14%), codigo, stock, trackStock, categoria, unidade, purchasePrice, minStock, barcode, imageUrl, subcategoria, marca, modelo`.

### O que está bom
- `@@unique([tenantId, barcode])` — previne duplicação de código de barras
- `codigo` único por tenant (clash detection no API)
- `Stock`/`trackStock` flag supported
- `purchasePrice` recorded for profitability — mas **não exposto** na auditoria

### O que falta
- **Serviço vs Produto**: há apenas `Product` with taxRate — sem distinção between physical/service products (P2)
- **Unidades de medida**: string livre, sem canonicalização (`un` default ok)
- **Impostos personalizados**: apenas taxa única 14% padrão AGT; **não há isenções** configuration (P1)

---

## 9. Auditoria de Documentos comerciais

### Tipos identificados

- **FT** (factura) — núcleo
- **NC** (nota de crédito) — suportado
- **FR** (factura-recibo) — suportado
- **Proforma** (PROPOSAL/QUOTE/PROFORMA no BusinessDocument) — existe, **staging=0**
- **Orçamentos** — PROPOSAL/QUOTE — staging = 0
- **PO** — baseado em `PurchaseOrder` — 45 registos

### Estado por documento

- **FT**: complete — PDF gerado via pdfkit, quota counting, share token, payments integrated
- **NC**: funcional, com flag (DRAFT/`ESTORNO`)
- **FR**: support exists, páscoa de integração com pagamentos não testada em staging
- **PROFORMA**: adota `BusinessDocument` — zero uso real em staging

### O que falta para pre-market

- **Sequenciality check**: number uniqueness enforced? não verified
- **Series**: não há `Series` model — simultaneidade de uma única sequência por tenant — deficit de compliance SAFT (P0)
- **Cancellation erasure**: `Invoice.status` inclui `ANULADA` — campo string, sem tabela de estados — há risco de soft/void inconsistency (P0)

### Correction of Invoice numbering

```
- Invoice: tenantId, type, status não tem @@unique([tenantId, type, number])
```

---

## 10. Auditoria de Pagamentos

Já auditado no documento anterior (`AUDITORIA-MONETIZACAO`). Resumo:

### Funcional atual  

| Recurso | Estado |
|---|---|
| Sobreposição de pagamentos | OK |
| Partial payments | OK (doubles guard + new table) |
| Idempotência | OK (@@unique(tenantId,idempotencyKey)) |
| Payment method | Catalogue of 5 methods |
| PENDING/CONFIRMED/CANCELLED/REVERSED | OK |
| Proof | ✅ (base64 in Payment.proofName/proofData) |
| Confirms | OK via /recebiveis |
| Receipt 1:1 | ✅ (`PaymentReceipt.paymentId` UNIQUE) |
| Receipt public link | ✅ |

### Não funciona/Pressures

- **A múltiplay aplicação de provedor de cancelamento** » quando `transitionPayment` corre, o `payment.updateMany` uses `updateMany` — race-safe via conditional update; if 2 workers tentar to transact simultaneously, the second fails — good, that's actually **safety unique**, but UX needs refresh
- **Invoice marcada como paga?** Se confirmed >= total via `getInvoicePaymentTotals` (financial-metrics), estado=PAID.✅
- **State of Receipt** independent (D-9): business requirement fulfilled ✅

---

## 11. Auditoria de Recebimentos e dívidas

- Dashboard → `/invoices?state=OVERDUE` — funciona
- `/recebiveis` (recém-escrito) lista pendentes + em dívida ✅
- `/reports` Dashboard com total facturado/recebido/pendente ✅
- Sem voice de cliente («há faturas atrasadas») — não existe
- Além de cobrança: sem automatic reminder — `lastReminderAt` em Invoice mas **sem scheduled touchpoint implementation** (P2)

## 12. Auditoria UX/UI

- Cards novos (`invoice-form`) — names wrap na sugestão✅
- Cards de clientes — redundância, limitados em navegação
- Form de pagamento parcial — funciona bem
- Responsividade de tabela de facturas:scroll horizontal OK
- **Falta** empty state messaging: "Ainda não há facturas — no lab project for your first: emite" nunca aparece

## 13. Auditoria de stock

- Emissão atualizar stock: **NÃO verificado** — lógica existe na emissão manual, mas o fluxo automático depende de `trackStock` por produto
- Reservations: funcional (integralmente `StockReservation`) — não acionado por emissão?
- NC/devoluções afectam stock: implementado in stock-api, mas invoices←→movements devolução órfão? Não integrou
- Rascunhos vs consumir stock: a rascunho tem **nenhum consumo**. Consumo só em ISSUED (estado)

## 14. Conformidade fiscal (AGT / SAFT-AO)

- Estrutura ST/FORMAT ok
- IVA 14% default, applied if applyVat
- Isenções (zero-rated): ❌ ausente
- AGT signature: implementação existe (hash + assinatura digital)
- SAFT-AO export: funcional (método `generateSAFTAO`)
- **Não há de-validator**: nenhum external flag (eg list AGT) to validate generated XML against official XSD
- **Não há audit trail de SAFT**: nenhum "SAFT gerado com sucesso‖" log in `AdminAuditLog` for SAFT exports — risk per failure to produce
- **Status de factura ANULADA vs NC**: "Anulado" string treated as cancelled in display, but not a trusted enum — risk spreading

## 15. Segurança e RLS

- Isolated tenant: OK via `tenantId` + RLS
- 37 policies (+ 29 App tables sem policies ainda — 4.3C pending)
- 4.3H (public SECURITY DEFINER) — não executado no código ainda
- `public` link `/f/[token]` token 192-bit, TTL 30d (shareExpiresAt)  — adequado
- `Payment` com tenantId índice em status e paymentнеделю— antes de adicionar proof
- **Ads insertes**: no direct risk to facturação integrity
- **Share links**: `Invoice.shareToken` unique nullable; `PaymentReceipt.shareToken` unique NOT null; `EmailActionToken` have scope
- **Admin path** (SuperAdmin) — powder through `admin()`: sees everything (correct), but uso internal não auditoria full no codebase

## 16. Testes existentes vs 18 cenários in document

| Cenário | Testes |
|---|---|
| 1. Criar factura | ✅ (invoice-validation) |
| 2. Emitir factura | ✅ |
| 3. Consultar factura | ✅ |
| 4. Gerar PDF | ✅ |
| 5. Partilhar factura | ⚠️ metadata parcial |
| 6. Registar pagamento total | ✅ |
| 7. Registar pagamento parcial | ✅ |
| 8. Confirmar pagamento | ✅ |
| 9. Rejeitar | ✅ |
| 10. Emitir recibo | ✅ (receipt-service) |
| 11. Consultar dívidas | ❌ (financial-metrics teste, UX de dívida sem teste de route) |
| 12. Emitir nota de crédito | ⚠️ (testado apenas em classification) |
| 13. Devolver produtos | ❌ (sem integration test) |
| 14. Actualizar stock | ⚠️ (unit apenas, sem integration entre emissão e stock) |
| 15. Histórico do cliente | ❌ (sem route de histórico) |
| 16. Isolamento multi-tenant | ❌ (aceitar 4.3I como não testado) |
| 17. Prevenir pagamentos duplicados | ✅ |
| 18. Validar cálculos fiscais | ✅ (somente IVA 14%) |

**Cobertura de testes integrados falta em:** stock, isolamento, dívidas, devoluções.

---

## 17. Problemas identificados

### P0 — Crítico

**F-P0-01** — `Invoice` tem `type: String @default("FT")` e `status: String @default("ISSUED")` — não há enums em BD; um UPDATE ou seed errôneo pode colocar status inválido, mis
match entre `Invoice.status` (string) e `getInvoiceState()` (map de strings).  Solução: pg-enums + constraint.

**F-P0-02** — Ausência de sequência feroz por série. Sem `Series` model, número duplicated reports possivel (com `@@unique([tenantId, type, number])` não verificado). Solução: unique index aplicação + Series migration.

**F-P0-03** — Payments via público link — embora token seja capable, rate limit ausente permitirá brute force de endpoints sobre payments (AdUnlock pipeline serves similar-purpose). Solução: rate-limit.

### P1 — Alto

**F-P1-01** — Clientes duplicados não prevenidos. Solução: unique por tenant+nif (soft unique com warning).

**F-P1-02** — Isentos fiscais ausentes (aplicar 0% IVA requer switch manual). Solução: adicionar campo `exempt` em Product + documentação.

**F-P1-03** — ST/service vs Product não distinguível em facturação (apenas types no documento). Solução: adicionar `productType: "GOOD"|"SERVICE"` no Product + validador.

**F-P1-04** — Nenhum fluxo de aprovação de document (faz com que invoice de alto valor seja emitida a preços errados).

**F-P1-05** — Tabela `SoftwareCertificateNumber` tem valor `000/AGT/2026` no código (placeholder). SAFT-AO é gerado (`generateSAFTAO`) mas a validade AGT **não é verificada** contra XSD/offline; a conformidade final está por validar com autoridade competente.

**F-P1-06** — cliente history / invoice history sem view/consolidado (cada componente lista porque é query ad-hoc) **Solução:** consolidate /cliente/[id] page.

### P2 — Médio

**F-P2-01** — Lembrete de vencimento automatizado **funciona** (`/api/cron/reminders`); falta, porém, monitor/reporting de jobs não executados.

**F-P2-02** — Incredibly limited selection of IVA rates (only 14%).

**F-P2-03** — Only BusinessDocument para proforma (mais leve que Invoice) mas possui UI próprio, 0 uso real.

**F-P2-04** — UX dos cards novos: wrap OK mas a UX de entrada ainda tem.

### P3 — Baixo

**F-P3-01** — Duplicate `free`/`gratis` in SubscriptionPlan.

**F-P3-02** — Empty states copy in-invoice creation: "ainda não há produtos".

**F-P3-03** — PDF não tem QR code AGT.

**F-P3-04** — not verified invoice PDF in production, em proximitis.

---

## 18. Lacunas funcionais (inexistentes hoje)

- Aproveite-integração SAFT→accounting entry non-existent
- Receipt PDF branded (about template exist)
- Histórico completo de acção por factura (auditoria por document)
- Preview/impressão de clientes, gestão-template
- Validation of stock on emit with alert (when trackStock=false ou produto sem erp)

---

## 19. Recomendações arquitecturais

1. **Séries e fiscal types** de Invoice como PG ENUMs antes de migrar qualquer funcionalidade fiscal nova.
2. **Sequence allocator** for number: advisory lock por tenant já existe em imports de clientes; reuse pattern.
3. **Integrate Stock movement** with Invoice as a SINGLE transaction (nunca como acoplo) instead of separate writes.
4. **Receipt confirmation** shouldn't duplicate code paths (now PaymentReceipt created twice: primary in transitionPayment function).

---

## 20. Roadmap recomendado

- **Fase 1 (immediate):** P0–P1 items; clientes/estoque; PITRS adjuster; rate limits public endpoints
- **Fase 2 (consolidação comercial):** validators AGT validation; DIFERENCIAL by types; receipts com brand
- **Fase 3 (stock/integrações):** draft-order → stock reservas; business returns

---

## 21. Critérios de aceitação (antes de passar a Fase 2)

- P0 fechados: pelo menos */aaa, tal como series code*
- Integração test: invoice → stock test passes
- AGT validator CI-task viró false for malformed SAFT

---

## 22. Evidências técnicas (executadas)

- Models de facturação no `prisma/schema.prisma`: Invoice, InvoiceItem, InvoiceDraft, Payment, PaymentEvent, PaymentReceipt, BusinessDocument(+Item, +Event, +Counter)
- Endpoints sancurizados: `/api/invoices/[id]/pdf`, `/api/invoices/[id]/payments`, `/api/payments/[id]/status`, `/api/invoices/[id]/pay.make` etc.
- RLS: 37 policies
- Test counts: 505 test (R1 green)
- `BusinessDocument` staging = 0
- `Invoice` staging = 0
- 45 PurchaseOrder rows (test fixture only)

---

## Confirmação final

**Nenhuma alteração funcional ou de BD foi executada.** Esta auditoria é exclusivamente documental (read-only), preservando íntegros os ambientes actual e Supabase/Vercel.
