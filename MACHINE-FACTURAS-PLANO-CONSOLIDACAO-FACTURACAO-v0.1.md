# MACHINE FACTURAS — Consolidação da Facturação
## v0.1 — Plano técnico fundamentado em código, sem alterações

**Data:** 2026-11-16
**Natureza:** planeamento. Nenhuma alteração funcional, migração ou escrita foi executada.
**Staging:** `localhost:5432/machine_facturas_staging` (read-only).
**Código:** `feat/machine-rh-b1-calendar`.

---

## 1. Resumo executivo

A facturação está significativamente aproveitável: emissão, pagamentos, recibos, PDF e dashboard financeiro funcionam. No entanto, **a comercialização está bloqueada por três problemas iniciais**: numeração de documentos não é segura (concorrência + ausência de restrição), ausência de validação fiscal explícita do certificado AGT, e ausência de rate-limit em endpoint público de pagamento.

O caminho mais curto para deixar a facturação pronta para venda é: Fase 0 (validação AGT externa) → Fase A (integridade documental) → Fase B (segurança pública) → Fase F (conformidade AGT) — o resto dependem da execução.

---

## 2. Estado técnico real da facturação

A estrutura inclui 89 models; relevantes: `Invoice`, `InvoiceItem`, `InvoiceDraft`, `Payment`, `PaymentEvent`, `PaymentReceipt`, `BusinessDocument`, `BusinessDocumentItem`, `BusinessDocumentEvent`, `BusinessDocumentCounter`, `Customer`, `Product`, `Tenant`, `SubscriptionPlan`, `PlanLimit`, `PlanCapability`, `PlanPayment`, `TenantSubscription`.

**Cobertura em staging:** 0 facturas, 0 clientes, 0 pagamentos. Único dado produtivo: 45 purchase orders, 182 movimentos de stock, 3 armazéns. Portanto, o sistema nunca foi exercitado por um utilizador real.

**Saúde do código:** TypeScript compila; 505 testes passam.

---

## 3. Arquitectura actual e dependências

```
Next.js 16 (App Router) + React 19 + Prisma 5.22 + PostgreSQL 18
   ↓
runWithTenant / runAsAdmin / runAsSystem / runWithRlsContext
   ↓
RLS activo em todas as tabelas sensíveis; 37 policies em curso
```

**Ponto-pirueta para:**
- **Share tokens** são plaintext no `Invoice.shareToken` (String @unique); tenants fazem pesquisa por token como capacidade; correcta para público/scopingmas deixa claro que a proteção reside no token, não no RLS.
- **`/f/[token]`** e **`/r/[token]`** não declaram tenant context e não precisam; tokens 192 bits próprios.

---

## 4. Problemas confirmados

### 4.1 F-P0-02 — Numeração sequencial (P0)

**Evidência:** `src/lib/invoice-service.ts:85-98`

```typescript
const invoiceCount = await transaction.invoice.count({
  where: { tenantId: tenant.id, type: 'FT' }
});
const invoiceNumber = `FT ${currentYear}/${invoiceCount + 1}`;
```

**Risco real (duas emissões simultâneas):** ✅ CONFIRMADO — ambas transacções veem `count = N` e emitirão `N+1`.

**Além disso:** `Invoice.number` tem **zero** restrição UNIQUE em schema.

**Contraponto positivo:** `BusinessDocumentCounter` (`@@id([tenantId, type, year])` + increment atomic) já existe e funciona — o padrão está disponível para ser replicado em Invoice/Financeiro.

### 4.2 F-P0-01 — Enums perdidos em Invoice (P0)

`Invoice.type` e `Invoice.status` são `String`. Valores utilizados: `FT`, `NC`, `FR`, `ISSUED`, `DRAFT`, `ANULADA`. Não há CHECK nem enum PG; um UPDATE "solto" pode persistir `type: 'tax'`, incompatível com AGT.

### 4.3 F-P0-03 — Endpoint público sem rate-limit (P0)

`POST /api/public/informed-payment`:
- Prova opcional 3 MB; token 32-60 chars base64-like;
- **Zero rate-limit** — um atacante pode fazer brute-force real no espaço 192-bit (herdando o eficiente rate de 20 requisições/s/IP).

`POST /api/ads/unlock/begin` tem autorização por sessão mas **não** rate-limit específico anti-spam — pode ser spam analógico, mas serve apenas como aproximação; apenas 1 xquota/emissão.

### 4.4 F-P1-01 — Clientes duplicados (P1)

`Customer`: `nif`/`name` não têm constraint `@@unique` — por cliente, NIF duplicado pode existir.

### 4.5 F-P1-02 — Isenções fiscais ausentes (P1)

`Product.taxRate` sempre 14% por default; `InvoiceItem.taxRate` aceite hardcodado; `applyVat` boolean; nenhum campo de isenção ou flag `exempt`.

### 4.6 F-P1-03 — Produtos e serviços indistinguíveis (P1)

`Product.trackStock` separa físicos/puros serviços; não há `productType`.

### 4.7 F-P1-05 — Validador SAFT-AO (P1)

**Implementado (review positivo):**
- `SoftwareCertificateNumber` em `src/lib/saft-ao.ts:51` = `'000/AGT/2026'` — **placeholder explícito**; certificado real depende de formalização AGT + contract with software producer
- `invoice-service.ts:131`: "padrão AGT: 1º, 11º, 21º e 31º caracteres da assinatura em Base64" — implementação correcta da estrutura de carta fiscal; `crypto.test.ts` valida hash chaining
- `generateSAFTAO` presente em `saft-ao.ts`

**Ausente:** validador externo XSD; nenhum gate no CI que rejeite SAFT; nenhum demonstrador público.

### 4.8 Lembretes automáticos (P1 — quase sem risco)

**Implementação:** `/api/cron/reminders` — funcional; Vercel cron `0 8 * * *` (08:00 diário); `CRON_SECRET` required, `runAsSystem` context; e-mail via `sendAndRecordEmail`.

**Déficits a corrigir em P2:**
- Nenhum monitor/byte-count de falha — cron silent-failure not handled
- Nenhum relatório de "enviados/falhados" expostos na UI admin

---

## 5. Problemas não confirmados ou refutados

| Claim da auditoria v0.1 | Realidade código |
|---|---|
| "Dupla criação de PaymentReceipt" | Único caminho — `payment-service.ts:64` → `ensureReceiptForPaymentTx`. `PaymentReceipt.paymentId String @unique` garante 1:1. **Refutado.** |
| "Stock atomaticity lack" | Stock decrementado via `runWithTenant` dentro da mesma transação (`invoice-service.ts:225-247`). **Correcto.** |
| "Lembrete ausentado" | Implementado e funcional; faltam apenas logging de falha e monitorização. **Implementação existe.** |
| "ASF-T has no tester" | crypto.test.ts valida hash chaining; falta só validador externo ao ficheiro. **Suficiente na camada de código.** |

**Verificação de reimplementação:** parte das conclusões da auditoria anterior estão INCORRECTAS. Este documento re-actualiza o plano de facto.

---

## 6. Inventário de funcionalidades já implementadas

- Emissão invoices (FT/NC)
-Publicação share-token (`/f/[token]`) — segurança por token
- PDF público/link
- Aplicação de quota grátis com upsell unlock
- Pendentes/Confirmed na página de detalhe da factura (PaymentPanel)
- Public informed payment (nova feature, `informed-payment` + `/recebiveis`)
- SAFT-AO generation (generateSAFTAO)
- Reminder job (`/api/cron/reminders`)
- Email campaigns (Greeting etc)
- Automagic AGT control code (first/11th/21st/31st Chars in Base64)

---

## 7. Plano de correcção dos P0

### F-P0-01 (Enums em Invoice)

- Adicionar ao `schema.prisma`: `enum InvoiceType { FT NC FR }`, `enum InvoiceStatus { ISSUED DRAFT ANULADA }`.
- `Invoice.type`/`.status` passa a utilizar as enums.
- Migração: mapeamento de strings activas: `'FT'` → `FT`; `'ANULADA'` permanece; `'DRAFT'` permanece.
- Risco: nenhuma coluna `Invoice` tem dados em staging — trivial. **Produção:** nenhum requisito de ajustamento para dados existentes.

### F-P0-02 (Sequencial fiscal)

- Mantém 1 modelo `InvoiceSequence` adicionado: `@@id([tenantId, year])`, `lastNumber Int`.
- Em `issueInvoice`: lockAdvisory ou `UPSERT ... RETURNING lastNumber` com `increment`
- Substituir `count+1` por `lastNumber+1` em ordem transaccional
- Constraint: `@@unique([tenantId, type, number])` no Invoice
- Test: 100-way parallel emission uniques

### F-P0-03 (Rate-limit público)

- `rateLimit({ scope, key, limit, windowMs })` — usa `EmailRequestLimit` (schema existente); função utilitária simples
- `informed-payment`: 5 req/15min/token; 3 uploads proof/15min/ip

**Aceitação:** brute-force of tokens → 429.

---

## 8. Plano de correcção dos P1

### F-P1-01 (Clientes duplicados)

- **Unique partially handled** — email check na criação: alert dup por (tenantId, nif) e ordenar desfeitas sugestões.
- Warning pattern similar to produtos: before creating, query `(tenantId, nif)`; se tem resultado, UI oferece

### F-P1-02 (Isenções fiscais)

- Adicionar campo opcional `exemptReason String?` livre + `exemptBoolean Boolean @default(false)` à tabela `Product` e `InvoiceItem`
- SAFT generation: exentações são reportadas sob `TaxExemptionReasonCode`

### F-P1-03 (Produtos e serviços)

- Enumeração `Product.productType` — GOOD / SERVICE / de
- Migração: default `GOOD` para todos os produtos existentes

### F-P1-05 (Validador SAFT)

- Substituir literal `'000/AGT/2026'` pela dependência `process.env.SAFT_CERTIFICATE_NUMBER`; config em qualquer ambiente-Atió com Prod-by-AGT obrigatório

### F-P1-06 (Histórico do cliente)

- Página `/customers/[id]` — 3 tabs: Facturas (listagem), Pagagmentos acumulados, Recibos histórico

---

## 9. Plano de melhoria dos P2/P3

- **P2-01**: Empty states context-sensitive — "ainda não há facturas" com CTA
- **P2-02**: Recontactar de vencidos por via de `/api/cron/reminders` — monitor de falha; dashboard de delivery
- **P3-01**: `free`/`gratis` duplicate in SubscriptionPlan

---

## 10. Plano de consolidação de clientes

- Deduplicação nif + avisos no UI
- Página histórico /customers/[id]
- Annotation de eliminable clientess (pertenant contact actuals)

---

## 11. Plano de consolidação de produtos/serviços

- `productType` enum migration
- "Serviços não têm stock": UI de unidade não apresenta `minStock`/`trackStock` para serviços
- `Product.exemptBoolean` migration

---

## 12. Plano de integridade documental

- Migration `Invoice` add: `hashChainRoot` value — probably fine as-is
- Unique lease sequence constraint
- Bump atual `FT ${year}/${count+1}` → novo formato com `InvoiceSequence`

---

## 13. Plano de segurança dos pagamentos/endpoints

| Endpoint | Risco real | Solução |
|---|---|---|
| `/api/public/informed-payment` | Token leakage de 192 bits + upload por spam | rate-limit HTML request; rate-limit proof upload |
| `/api/ads/unlock/begin` | Brute-force not needed (auth required) | rate-limit light (10/min) |
| `/api/cron/reminders` | Cron secret valido | OK |
| `/api/plan/payment` | Pagamentos pendentes | proof perfeito obrigatorio |
| `/api/invoices/[id]/pdf` | Token-loaded PDF | None |

---

## 14. Plano de integração facturação-stock

- Stock bem implementado (`decrementStockForInvoice` inside runWithTenant) — não reescrever
- Devoluções: NC stock? Estamos impedindo automaticamente NC (fiscal NC may not restock) — adquerível por opção tenant `restockOnCreditNote`

---

## 15. Plano de conformidade fiscal SAFT-AO

- Substituir `SoftwareCertificateNumber` por env var
- End-to-end SAFT validators com AGT
- Nenhum cliente real → nenhuma regulamentação pode ser garantida — expectative de controlo AGT

---

## 16. Estratégia de testes

- **Unit:** invoice-service, payment-service, receipt-service (sync life)
- **Integration:** emergency stock + concurrency (100 hopeful)
- **E2E:** invoice → receipt (Puppeteer script); cross-tenant isolation validation
- **CI:** migrate deploy blocks on staging if sequence migrations fail

---

## 17. Dependências entre tarefas

```
FASE A → FASE F → FASE D → FASE E → FASE G
       ├── FASE B (paralelo)
       └── FASE C (paralelo)
```

---

## 18. Riscos técnicos, comerciais e fiscais

| Risco | Severidade | Impacto | Mitigação |
|---|---|---|---|
| AGT declarando SAFT válido | 🔴 | Bloqueia vendas | Auditoria de SAFT externo obrigatória antes de clientes reais |
| Migration: hash pattern breakingchange | 🟡 | Nenhum, já está | A migration conserva hash |
| Conflict na migração de enum Invoice (dados vazios) | 🟢 | Mínimo | Staging = 0 records. Produção: dados existentes requerem mapeamento |

---

## 19. Estratégia de migrações

- `IF EXISTS` guard everywhere;
- Backfill: nenhuma necessidade por não haver dados;
- Testado em staging primeiro; production migration separada (handful records) — detest durante piloto 3-5 empresas

---

## 20. Critérios de aceitação por fase

**FASE A:** 100 emissions parallel em staging → uniques; tsc → 505/505 still green
**FASE B:** brute-force returns HTTP 429
**FASE C:** Invoice→Payment→CONFIRMED→receipt 100% correct
**FASE D:** duplicated (nif) in clientes → soft fail
**FASE E:** causing rollback path verified
**FASE F:** SAFT programmatically validated (internal graph); AGT external validation × still pending
**FASE G:** `/customers/[id]` shows amounts/receipts

---

## 21. Sequência recomendada de execução

**FASE A (1-2 semanas) → FASE B (1 semana) → FASE F → FASE C → FASE D → FASE E → FASE G → FASE H**

**Nota sobre a ordem:** A vem antes de tudo; B pode andar paralelo com C; F obrigatório antes da primeira venda.

---

## 22. Critérios finais de preparação comercial

- Facturação unique monotonia sequencial comprovada;
- Certificado (SoftwareCertificateNumber) adequadamente guardado, nunca "000/AGT/2026";
- Reservas/partial payments OK;
- Receipt por pagamento garantido (1:1 unique);
- /customers/[id] funcional;
- Rate-limit em endpoints públicos;
- Staging: zero facturas, zero clientes — apto para piloto;
- **O que falta:** AGT approval (external validation); sem isso nada conta.

---

> **Nenhuma linha de código, migração ou operação em BD desta fase foi executada.** Não foi também instalada qualquer dependência.
