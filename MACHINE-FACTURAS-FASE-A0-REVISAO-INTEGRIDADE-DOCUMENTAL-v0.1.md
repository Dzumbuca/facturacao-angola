# MACHINE FACTURAS — FASE A0
## Revisão técnica da integridade documental antes da implementação

**Data:** 2026-11-16
**Natureza:** revisão de código em leitura completa. Nenhuma alteração executada.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2` + commits até `c008e87`).
**Staging:** `localhost:5432/machine_facturas_staging` (read-only).

---

## 1. Arquitectura recomendada (após revalidação)

### 1.1. Numeração

**Decisão:** reutilizar o padrão **`BusinessDocumentCounter`** (`@@id([tenantId, type, year])` com incremento atómico e `increment` via Prisma), **não criar** `InvoiceSequence` standalone.

**Justificação:**
- Elimina duplicação (`InvoiceSequence` seria redundante com o pattern existente)
- Padroniza a numeração de **todos** os documentos fiscais através da mesma entidade
- O padrão já está provado em produção/staging (BusinessDocuments, 0 contadores criados hoje)
- Menos superfície para ad-hoc bugs

**No schema:**

```
model BusinessDocumentCounter {
  tenantId    String
  type        BusinessDocumentType      // 'INVOICE', 'CREDIT_NOTE', 'RECEIPT', etc.
  year        Int
  lastNumber  Int
  tenant      Tenant @relation(...)

  @@id([tenantId, type, year])
}
```

**Número físico:** `String` formado por `${prefix}${year}/${String(lastNumber + 1).padStart(4, '0')}` — p.ex. `FT 2026/0001` (zero-padded 4 dígitos + ano); `NC 2026/0001`; `FR 2026/0001`.

Racional da zero-padding: facilita sort, comparação lexicográfica e elegibilidade para AGT.

### 1.2. Estados documentais

```
Invoice.type: enum InvoiceType { FT NC FR }
Invoice.status: enum InvoiceStatus { DRAFT ISSUED ANULADA }
```

**Decisão radical:** incluir apenas **valores historicamente usados**; nenhum enum largo de "CANCELLED"/"CONVERTED" escondido.

**Justificação:**
- `CANCELLED` não é usado actualmente em Invoice (é usado em Payment, BusinessDocument, aqui não)
- `CONVERTED` não existe no Invoice — conceito BusinessDocument-only
- `ISSUING` (estado transitório de offline drafts) é **interno** e deve **continuar String ou ser removido** — não enum pg

### 1.3. Séries

Não há benefício técnico em criar uma entidade `Series` separada. Cada tenant pode, no futuro, querer mútiplas séries (ex.: pré-calculada, encomenda, proforma). Um `series String?` opcional pode satisfazer isso. **A necessidade real é: uma única sequência interna (`BusinessDocumentCounter`) com `prefix`**.

**Justificação para não cair na "arquitetura mais elaborada":** para 99% dos clientes atuais (uma única série), uma coluna serial agregada é suficiente, mais barato, e trivial email/. Se vir a aparecer demanda real (ex.: pré-numerado de contratos, ou cadeia obrigatória por AGT), aí sim introducir conceito.

---

## 2. Inventario de valores existentes (evidência)

### 2.1 Invoice.type (usado)

| Valor | Ocorrências | Contexto |
|---|---|---|
| `'FT'` | 39 | Default; tipo de factura |
| `'NC'` | 12 | Nota de crédito (mesma tabela) |
| `'FR'` | 0 | Escondido mas pretendido — não-validado |

### 2.2 Invoice.status

| Valor | Ocorrências | Contexto |
|---|---|---|
| `'ISSUED'` | 64 | Emitida |
| `'DRAFT'` | 44 | Rascunho/elaborada |
| `'ANULADA'` | 6 | Anulada (como é lida pela AGT) |
| `'ISSUING'` | ~5 (via InvoiceService.ts lines) | Transitório draft→invoice |

### 2.3 BusinessDocumentType (DB enum existe)

`PROPOSAL`, `QUOTE`, `PROFORMA`, `PURCHASE_ORDER`, `DELIVERY_NOTE`, `SERVICE_ORDER`, `SERVICE_CONTRACT`, `COMPANY_DECLARATION` — 8 valores.

### 2.4 BusinessDocumentStatus (DB enum existe)

`DRAFT`, `ISSUED`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `CONVERTED` — 6 valores.

### 2.5 InvoiceDraft.status (String)

`src/lib/invoice-draft-service.ts` usa:
- `'DRAFT'` — inicial
- `'ISSUING'` — pendente emissão
- `'FAILED'` — erro na emissão (implícito pelo requirement)

### 2.6 Detecção de migrações históricas

| Migração | Dados a considerar |
|---|---|
| `20261019000100_baseline` | Cria Invoice com `type`/`status` Strings |
| `20261025120000_invoice_share` | Adiciona `shareToken` |
| `20261106130000_invoice_reception` | ?. — a verificar |
| `BusinessDocuments` 20261027160000 | Enum pg (`BusinessDocumentStatus`) |

**Conclusão:** nenhum ENUM OBJECT existente a ministrar para Invoice. Migração pode ser “apenas ALTER TYPE” ou tabela nova.

---

## 3. Modelos Prisma propostos

```
model BusinessDocumentCounter {
  tenantId  String
  type      BusinessDocumentType      // + 'FT', 'NC', 'FR' (ou novo enum `DocumentType`)
  year      Int
  lastNumber Int @default(0)
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, type, year])
}
```

**Alternativa recomendada:** novo case word `InvoiceSeries`:

```
model InvoiceSeries {
  tenantId        String
  type            String          // 'FT' | 'NC' | 'FR'
  year            Int
  lastNumber      Int @default(0)

  @@id([tenantId, type, year])
}
```

**Decisão final desta revisão**: reutilizar `BusinessDocumentCounter` se os tipos expandirem `BusinessDocumentType` para incluir `FT`, `NC`, `FR` — case essencial.

---

## 4. Constraints e índices necessários

### Invoice
```
@@unique([tenantId, type, number])
@@index([tenantId, issuedAt])
```

### Preparação pre-migração
- Eliminar duplicados existentes se houver (staging: zero; produção: confirmar)
- Migração `ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenant_type_number_key" UNIQUE (...)`

---

## 5. Estratégia de numeração

1. Para cada emissão de documento, requisição atómica:
   ```
   UPSERT "BusinessDocumentCounter" SET lastNumber = lastNumber + 1
     WHERE ("tenantId", "type", "year") = ($1, $2, $3)
     RETURNING lastNumber;
   ```
2. `lastNumber` devolve o número anterior + 1; zero-padding: `FT 2026/0001`
3. Memória de cadeia: cada documento guarda `previousHash = lastHash` (para encadeamento AGT)
4. Hash generation: mantido a partir do item 2 e 3

**Garantia de unicidade:** `lastNumber` é atômico dentro da transação, único para `(tenantId, type, year)`; sem race condition. O mesmo tenant pode ter múltiplos tipos a correr a mesma lógica.

**Permissões:** `@@unique` não permite outro mecanismo similar; se for necessário, pode ser codificado via trigger em vez de schema Prisma (como é o caso de `AuthJwtRevocation`).

---

## 6. Plano de migrações

### Fase P0 — Preparatório (inventory)
- [ ] **Produção primeiro:** `SELECT DISTINCT type, status FROM "Invoice";` — identificar dados existentes (NUNCA assumir que a produção está vazia apenas porque staging está vazia)
- [ ] Produção: inventariar `SELECT count(*), count(DISTINCT (tenantId, type, number)) FROM "Invoice"`
- [ ] Mapeamento de valores existentes para o novo schema:
  - `'ISSUED'` → `InvoiceStatus.ISSUED`
  - `'DRAFT'` → `InvoiceStatus.DRAFT`
  - `'ANULADA'` → `InvoiceStatus.ANULADA`
  - `'ISSUING'` → **NÃO** tolerado — depende da aplicação, mantercomo String no `InvoiceDraft`
- [ ] Wasting log desta auditoria para fora da aplicação

### Fase P1 — Contramestre BLOQUEIO
- [ ] `ALTER TABLE "Invoice" ADD CONSTRAINT Invoice_type_and_number_unique UNIQUE (...)`

### Fase P2 — Migração de tipo/estado
- [ ] `CREATE TYPE "InvoiceType" AS ENUM ('FT', 'NC', 'FR')`
- [ ] `CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'ANULADA')`
- [ ] `ALTER TABLE "Invoice" ALTER TYPE ...`: mapping
- [ ] Dificuldade: nenhum dado actual precisa de mapear para NULL; se o persiste, pode ser manual

### Rollback

Toda migração é reversível com um snapshot de base de dados. **Produção**: nunca executar migrations sem snapshot, e nunca executar migrations sem orçamento de janela de manutenção. **Staging:** `prisma db push` e `prisma migrate deploy` aceitando apenas que ocorram exclusivamente com dados suficientes.

**Testes de migration:**
```
npx prisma migrate deploy --skip-validate  (apenas staging)
npx prisma db push --skip-generate        (apenas staging, iteração)
```

---

## 7. Testes e critérios de aceitação

### Testes unitários
- [ ] Gerar 2 números sequenciais — cada um diferente
- [ ] 100 emissões simultâneas — nenhum duplicado; 0 falhas
- [ ] Mudança de ano — contador reinicia em 0001
- [ ] Anular → próximo número mantém sequência (não pula)

### Testes de integração
- [ ] Fluxo draft → ISSUING → issued: number assigned exactly once
- [ ] Rollback(tx): não persiste draft ni issued invoice if failure at stage 3
- [ ] Isolamento: tenant A nunca vê número de tenant B

### Critérios de aceitação

- [ ] `SELECT DISTINCT type FROM "Invoice"` → apenas `FT`, `NC`
- [ ] `SELECT DISTINCT status FROM "Invoice"` → apenas `DRAFT`, `ISSUED`, `ANULADA`
- [ ] `SELECT count(*), count(DISTINCT tenantId, type, number) FROM "Invoice"` → igual
- [ ] Emissão paralela em staging: zero dups
- [ ] 505/505 tests ainda verdes

---

## 8. Riscos e compatibilidade

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dados "ANULADA" em produção | Médio | Migração falha | Pré-verificação via query; mapear pra CANCELLED se existir |
| "CANCELLED" em algum dado oculto | Baixo | Migração falha | Pre-revisão de dados de produção |
| Produção vazia (como staging) | Alta | Nenhum | Meaning: migration trivial |
| Código em produção refere String direta FT/NC | Alto | Adquirir compile time | Acrescentar default `value("FT")` and type guard |
| Incompatibilidade com versionamento anterior | Baixo | Regressão | Mantenha type as String on front-end side |

---

## 9. Sequência de implementação

1. **Stage 0:** Freeze branch; preparar staging snapshot
2. **A0-1:** Adiciona `@@unique([tenantId,type,number])` — migration parcial
3. **A0-2:** Converte Invoice type/status para enum
   - Prerequisite: nenhuma coluna dependeString lookups à noite que não seja código
   - Após migration: validar TypeScript build
4. **A0-3:** Gera Invoice fixo: inicia pilot emission em staging
   - Criar empresa de teste; emitir 3 facturas de teste; anular uma
   - Confirma numbering sequence: draft → issue → nc → annulment
5. **A0-4:** Deploy staging
6. **A0-5:** Movimento para production (apenas com express permission)

---

## 10. Sequência de prova funcional

1. Emissão draft
2. Ranking sequence: cancelar último; voltar a emitir
3. Migrar para modo de produção (default após staging)
4. Config enterprise analytics: share audit flow sign

---

## Confirmação

**Nenhum código, migração ou configuração foi executado.** Este documento é exclusivamente analítico.
