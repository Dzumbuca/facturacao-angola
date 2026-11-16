# MACHINE FACTURAS — Plano Técnico de Consolidação da Facturação
## v0.1 — Base saneante, faseamento e critérios de aceitação

**Data:** 2026-11-16
**Decisão:** plano baseado no código real e na auditoria anterior; nenhum executa alteração.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).
**Staging:** localhost:5432/machine_facturas_staging (read-only).
**Regras de produção:** zero escrita; zero migrations executadas; preservar dados.

---

## 0. Reconciliação dos dados da auditoria anterior

| Satus na auditoria v0.1 | Confirmação neste plano |
|---|---|
| **F-P0-01** — Tipo/estado de factura String sem enum | ✅ CONFIRMADO |
| **F-P0-02** — Numeração via count+1, sem sequencial/OK por tenant | ✅ CONFIRMADO (e pior que o descrito) |
| **F-P0-03** — Endpoints públicos sem rate-limit | 🟡 PARCIAL — `informed-payment` não tem limiter; a secção de email já tem `allowEmailRequest` reutilizável |
| **F-P1-01** — Clientes duplicados no registo | ✅ CONFIRMADO |
| **F-P1-02** — Isenções fiscais ausentes (só 14% default) | ✅ CONFIRMADO |
| **F-P1-03** — Produtos vs Serviços indistinguíveis | ✅ CONFIRMADO |
| **F-P1-05** — SAFT-AO não validado | 🟡 PARCIAL — a geração existe (`SoftwareCertificateNumber` sério e AGT hash); o validador externo não existe; o código merece cuidado mas foi **inadequadamente descrito como ausente na auditoria anterior** como ausente |
| **F-P1-06** — Histórico do cliente comburia | 🟡 PARCIAL — a relação `Invoice` → `Customer` permite histórico, o que falta é uma página consolidada |

**Correcções à auditoria anterior:**
- **F-P2** — "Recebimento nao atomico de stock": **RESOLVIDO/DEPRECATED** — `invoice → stock` é transaccional, `decrementStockForInvoice` corre dentro de `runWithTenant`; lista `RECEBIVEIS` corre separadamente.
- **F-P2** — "PaymentReceipt sem mecanismo de série": **RESOLVIDO** — `ensureReceiptForPaymentTx` fica no mesmo local, sem duas vias duplicadas; única fonte de criação. Portanto "PaymentReceipt dual-creation" era um erro da auditoria.

---

## 1. F-P0-02 (Sequenciamento de número de documentos)

### 1.1 Diagnóstico

```
const invoiceCount = await transaction.invoice.count({ where: { tenantId, type: 'FT' } });
const invoiceNumber = `FT ${currentYear}/${invoiceCount + 1}`;   // NAO concurrenctalmente safe
```

Risco real:
- 2 transações simultâneas veem o mesmo `invoiceCount`. `N = count + 1`. Usam o **mesmo número**.
- Contraparada do padrão `BusinessDocumentCounter` (`@@id([tenantId, type, year])` + `increment` atomic), já usada por BusinessDocument.
- Sem constraint `@@unique([tenantId, type, number])`.

### 1.2 Ficheiros e models

| O que | Onde |
|---|---|
| Model | `prisma/schema.prisma` (adicionar `InvoiceCounter` ou reutilizar `BusinessDocumentCounter` se abraçar mais tipos) |
| Service | `src/lib/invoice-service.ts` (`issueInvoice`) |
| Schema | `@@unique([tenantId, type, number])` em `Invoice` |
| Tests | `tests/invoice-service.test.ts` (criar/alternativa) |

### 1.3 Recomendação: `InvoiceSequence` dedicado

```prisma
model InvoiceSequence {
  tenantId   String
  year       Int
  lastNumber Int    @default(0)

  tenant     Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, year])
}
```

Novo número: `UPDATE "InvoiceSequence" SET lastNumber = lastNumber + 1 WHERE ... RETURNING lastNumber` dentro da mesma transacção — mesmo padrão que `BusinessDocument` usa. **Reutilizar `BusinessDocumentCounter` para todos os tipos fiscais** elimina duplicação: adicionar discriminator `series` (\u201cINVOICE-1000\u201d) em `BusinessDocumentCounter`.

### 1.4 Migração

- `CREATE TABLE IF NOT EXISTS "InvoiceSequence"` 
- Backfill a partir de FT com MAX(`lastNumber`) — cuidadoso tratar sequência já existente: para cada FD→count → até ao MAX) e `total = count` actual; sufixo sem colisão
- Aguardar release com back-off se colisão detectada (fail fast conservador, sem fallback silencioso)

### 1.5 Riscos

- Se `@@unique` criaria conflict, a migração falha — **OK** (é a ideia)
- Ambiente de produção com dados reais: backfill tem de usar transacções curtas; vai ser separado
- **Bump**: `invoiceNumber = FT ${year}/${next}` vs 1000 series AGT exige all-numeric series

## 2. F-P0-01 (Enums para tipo/estado)

### 2.1 Diagnóstico
- `Invoice.type` e `Invoice.status` como `String`: nenhum check em BD
- `BusinessDocument` tem `enum BusinessDocumentType / BusinessDocumentStatus` com cast fracos em TS — enum é a forma correcta

### 2.2 Solução

```prisma
enum InvoiceType    { FT NC FR }
enum InvoiceStatus  { ISSUED ANULADA DRAFT CONVERTED }
enum DiscountType   { AMOUNT PERCENT }
```

**Migração**: `ALTER TABLE "Invoice" ALTER COLUMN ... TYPE IF EXISTS ...;` precisa de mapear strings actuais, incluindo `"DRAFT"` vs `"EM_ISSAO"` usado na off-sync: a off-sync já usa `"EM_ISSAO"`, dividir em dois

### 2.3 Testes
- Inserir invalid string → erros imediatos (violação CHECK/constraint enum)
- Verificar os defaults aplicados: `FT` válido; conversions

## 3. F-P0-03 (Rate-limit público)

### 3.1 Diagnóstico
- Apenas `allowEmailRequest` para scoping email
- Nenhuma proteção de `/api/public/informed-payment` (texto form HTML + PDF) contra brute-force de token / DoS por upload de PDFs 3 MB

### 3.2 Solução

Nova função reutilizável: `rateLimit({ key, limit, windowMs })`, usando a tabela existente `EmailRateLimit` stock? Já existe um padrão de `EmailRequestLimit` — ins"tanciar isso para `scope = 'informed-payment'`.

**Default:** 5 tentativas / 15 min por token; 3 uploads / 15 min por IP (validado por `req.headers.get('x-forwarded-for')`).

### 3.3 Público endpoint authorization

| Endpoint | Segurança hoje | Proposta |
|---|---|---|
| `/api/public/informed-payment` | token shareToken + input validation | + rateLimit + reforço de content-length limit (cap 3 MB comprovado) |
| `/api/ads/unlock/begin` | logado | quota mensal enforcements já existentes |
| `/api/cron/reminders` | cron | já em privado via cron secret |

### 3.4 Migração
- Adicionar índice/scope.': `EmailRequestLimit(scope: 'informed-payment', scopeKey: <token-hash>)` - efectivamente não precisar de migração porque é uma tabela genérica com `scope` e `key`

## 4. F-P1-01 (Clientes duplicados)

### 4.1 Diagnóstico
- `Customer`: `name, nif, email, address`; no `@@unique([tenantId, nif])` (where nif presente) nem `@@unique([tenantId, name])`

### 4.2 Recomendação

**Soft constraint:**
```prisma
@@unique([tenantId, nif])  // só quando nif NOT NULL — PostgreSQL partial unique index
-- ou
@@unique([tenantId, lower(name)])  -- usando lower()
```

Modelo mais seguro:
- `ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenant_nif_unique" UNIQUE NULLS NOT DISTINCT ("tenantId", "nif")` (PostgreSQL 15+)
- UI de criação: detetar duplicado por name/nif antes de criar — oferecer opção `prosseguir/irritável`

## 5. F-P1-02 (Isenções fiscais)

### 5.1 Diagnóstico
- `Product.taxRate` default 14.00%; `Invoice.applyVat` boolean; apenas 14% ou 0% via boolean
- Isenções exige `taxExemptReason` (eg "TRANSPORTADORA" ou "REGINAL") ou `taxCode` (já raramente visto em Angola)
- AGT permite isenções dependendo da contratualização - pedido sugerido em SAFT (e.g. campo `TaxExemptionReason`)

### 5.2 Solução

- Adicionar `Product.exemptBoolean` default false:
- Adicionar `InvoiceItem.exemptOverride Boolean?` + `InvoiceItem.exemptReason String?` (opcional perceptível por tenant)
- SAFT XSD de exentação AGT sales reason codes: lista de codes catalogada (I20= ISENCAO REGIONAL, I10=OutroFornecedor, I30=Max-Tax used)

### 5.3 Testes
- Cenários isentos forzados: factura com 2 lines, 1 exempt "ZERO", 1 normal 14%

## 6. F-P1-03 (Produtos vs Serviços)

### 6.1 Diagnóstico
- `Product` inclui `unit` — livre text; `trackStock` já distingue físicos de puros serviços
- Mas não há enum/collação de `productType` (GOOD / SERVICE / NON_STOCK)

### 6.2 Solução

```prisma
enum ProductType { GOOD SERVICE NON_STOCK }
Product.productType ProductType @default(GOOD)
```

Migração: `ALTER TABLE "Product" ADD COLUMN "productType" ... DEFAULT 'GOOD'`
Ondcuemza: produtos serviços herdam `trackStock = false` automaticamente — UI esconder stock control.

## 7. F-P1-05 (Validador SAFT-AO)

### 7.1 Diagnóstico
- No `src/lib/agent-service.ts` há `AGT-Compliance-Assistant` (runtime AI-assistant) e `crypto.test.ts` — hash chain tests (SHA)
- Nenhuma função valida o SAFT txt/rejeitou contra esquema oficial (XSD externo AGT n/a)

### 7.2 Solução

- Consumir **AGT Schema oficial**:
  1. Escrever `scripts/validate-saft.ts` com esquema XSD (de olho no portal de AGT público)
  2. Integrar no CI como `npm run validate:saft` (stub offline inicial)
- SAF/AO sample file output test: golden test injection (nenhuma produção)

## 8. F-P1-06 (Histórico do cliente)

### 8.1 Diagnóstico
- Customer relation to Invoice + BusinessDocuments is 1:N; UI não lista claro (apenas agrupados por código)

### 8.2 Solução

Pagina `/customers/[id]` (nova rota):
- 3 tabs: Profile | Facturas (N/NC/FR) | Notas de crédito | Pagamentos
- Summaries: "Total faturado / Total recebido / Pendent" via mesma `getInvoicePaymentTotals`

---

## 9. Plano por fases

### FASE A — Integridade documental (1–2 semanas)

- [ ] F-P0-02: `InvoiceSequence` migration (database não tocada em produção — usar staging)
- [ ] F-P0-01: enums genéricos migration (Mapeamento strings→enum para FT/N(F)R)
- [ ] Test: sequência em pressão > 100 emissões paralelas em staging
- [ ] Backfill: invoice count at staging = 0 (sem risco); produção: verificar com empresa piloto

### FASE B — Segurança de operações públicas (1 semana)

- [ ] Rate limit reusável (`email-actions.ts` patterns → `rateLimit`)
- [ ] Aplicar a `informed-payment` (limites: 5req / 15min / token)
- [ ] Test: brute-force no endpoint em staging

### FASE C — Pagamentos e recibos (1 semana)

- [ ] Consolidar handler de PaymentReceipt (única criação via transitionPayment)
- [ ] Enforcer recibos em todas as confirmação de pagamento por listview
- [ ] Test: cria factura → pagamento → confirmação → receipt id

### FASE D — Clientes e produtos (1 semana)

- [ ] F-P1-01: Programa importánico Deduplication script
- [ ] F-P1-03: migrate adds `productType` with default, invoice code ignores por default

### FASE E — Integração facturação-stock (1 semana)

- [ ] Validar `decrementStockForInvoice` in runWithTenant atomically (já transacional; teste explícito)
- [ ] Garantir rollback: facturar stock curto → erro emissão inteiro (INVOICE + stock) regressa

### FASE F — Conformidade fiscal (1–2 semanas)

- [ ] SAFT validator XSD
- [ ] Exemption reason codes (catálogo AGT): `ex:ro` e `ex:io`
- [ ] Platepholders substituídos por certificados reais

### FASE G — Histórico e relatórios

- [ ] `/customers/[id]` com tabs histórico
- [ ] Sync de relatórios (financial-metrics) com nova origem autoritativa (via /recebiveis)

### FASE H — UX/UI

- [ ] Cards de product/cliente já com fix wrap — OK
- [ ] Toast success/reports com para além de engolecinto visual

---

## 10. Dependências entre fases

```
A ──► B ──► C ──► D ──► E ──► F ──► G ──► H
       (D opcional antes de C)
```

Tarefa total: ~6–8 semanas com pacotes reduzidos.
FASE F (fiscal) depende de A (numbering) e de D (service/produto).
FASE B pode ser parallel a C/D 

---

## 11. Riscos e mitigação

| Risco | Mitigation |
|---|---|
| Backfill em produção cria duplicados (dados existentes) | Migração `IF EXISTS` + verificação pre-deploy |
| `enum` de estado quebra `InvoiceDraft` (`EM_ISSAO`) | Mapeamento real durante migration |
| Products `productType`: existentes default GOOD | OK — invoice mostra serviços sem control stock |
| `Series` em produção: se já existem FT, invoice new sequence começa em 1 | Primeiro com cliente piloto real; não em produção viva. |

---

## 12. Critérios de aceitação

- [ ] Migração x FT/NC/FR em stagião — 0 dups em emissão 50× paralela
- [ ] Token bruteforce bloqueado, 5 tentativas/15min returns 429
- [ ] Exemption reason happy path: factura com ins"tall zero-tax passes
- [ ] Emissão de factura com stock errado → rollback sem residue
- [ ] SAFT golden test com schema oficial: factura passa validação
- [ ] Section de cliente: shows invoices total count, sum, last paid, last overdue

---

## 13. Não-conformidades gerenciais (do editorial)

- Não alterar Subscrições (não recriar)
- Não forçar AGT via código sem validação real
- Não reduzir comportamento do RLS

---

## 14. Evidências técnicas

- `Invoice` series count-based — `invoice-service.ts:85-98`
- `BusinessDocumentCounter` pattern — `schema.prisma:1304`
- `PaymentReceipt` single-creation path — `receipt-service.ts:9` (`ensureReceiptForPaymentTx`)
- `informed-payment` token check — `informed-payment/route.ts` (searches by shareToken without rate-limit)
- `allowEmailRequest` generic rate-limit — `email-actions.ts:16`

---

> **Nenhum passo neste documento foi executado.** Este plano pede por fases, dependências e critérios de aceitação. Executar qualquer item requer autorização explícita — como siempre, preferir terminar Fase A primeiro.
