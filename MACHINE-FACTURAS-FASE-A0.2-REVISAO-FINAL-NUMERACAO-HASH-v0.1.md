# MACHINE FACTURAS — FASE A0.2
## Revisão final — numeração e cadeia de hash

**Data:** 2026-11-16
**Natureza:** revisão técnica. **Nenhuma alteração funcional, migração ou configuração foi executada.**
**Código:** `feat/machine-rh-b1-calendar` (HEAD `c008e87`).
**Staging:** read-only.

---

## 1. Sumário executivo

A numeração actual e a cadeia de hash são tecnicamente frágeis. O código de emissão (`invoice-service.ts:93-97` e `329-333`) usa `count + 1` sem restrição UNIQUE e sem serialização concorrencial na contagem. A cadeia de hash lê a última factura sem protecção (`READ COMMITTED`). O resultado combinado: duas emissões simultâneas produzem números duplicados e bifurcam a cadeia documental — incompatíveis com o requisito de auditabilidade AGT.

**Decisão final recomendada:**

- Criar `InvoiceSeries` como tabela dedicada para numeração fiscal
- Atomicidade via `upsert` com increment (mesmo padrão de `BusinessDocumentCounter`)
- Serialização global da cadeia de hash por tenant via `pg_advisory_xact_lock`
- Conversão para enums `InvoiceType` e `InvoiceStatus` em duas fases de deploy

**Maturidade para iniciar a implementação:** não suficiente sem validação AGT prévia. **Decisão:** APROVADO COM CONDIÇÕES.

---

## 2. Estado actual — código e base de dados

### 2.1 Modelo em `prisma/schema.prisma`

`Invoice` não tem `@@unique([tenantId, type, number])`. `type` e `status` são `String`, livres, sem constraint PG.

### 2.2 Transação actual

`runWithTenant` (tenant-db.ts) não força `isolationLevel` → PostgreSQL usa `READ COMMITTED` por omissão. Não há bloqueio específico para a contagem do número.

### 2.3 Emissão de factura — `invoice-service.ts` linha 84–98

```typescript
const lastInvoice = await transaction.invoice.findFirst({
  where: { tenantId: tenant.id },
  orderBy: { createdAt: 'desc' }          // sem lock — duas transações lêem o mesmo row
});
const previousHash = lastInvoice ? lastInvoice.hash : null;

const invoiceCount = await transaction.invoice.count({
  where: { tenantId: tenant.id, type: 'FT' }
});
const invoiceNumber = `FT ${currentYear}/${invoiceCount + 1}`;
```

### 2.4 Emissão de nota de crédito — linhas 329–333

```typescript
const ncCount = await tx.invoice.count({ where: { tenantId, type: 'NC' } });
const currentYear = new Date().getFullYear();
const ncNumber = `NC ${currentYear}/${ncCount + 1}`;
```

### 2.5 Bloqueio parcial existente — linhas 207–212

```typescript
await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;
const invoiceLimit = await resolveInvoiceLimit(transaction, tenant.id);
```

**Ponto-chave:** o `FOR UPDATE` ocorre **depois** da atribuição do número (depois da contagem no passo 93). Garante a viabilidade da quota e do stock check, não a unicidade do número.

### 2.6 Estado de dados em staging

0 facturas; 0 documentos comerciais com dados; 3 armazéns; 182 movimentos de stock; 45 purchase orders. Staging nunca foi exercitado para emissão.

### 2.7 Testes de concorrência

Inexistentes para invoice. `ad-unlock-core.test.ts` cobre o fluxo de desbloqueio, não de factura.

---

## 3. Problemas ordenados por gravidade

| # | Problema | Severidade | Evidência |
|---|---|---|---|
| P-A-01 | Número via `count+1` — race condition em emissões simultâneas | 🔴 | invoice-service.ts:93-97 e 329-333 |
| P-A-02 | `Invoice.number` sem restrição UNIQUE por tenant/tipo/número | 🔴 | prisma/schema.prisma — ausência de `@@unique` |
| P-A-03 | Cadeia de hash bifurca sob concorrência | 🔴 | invoice-service.ts — sem lock da cadeia |
| P-A-04 | NC executa sem lock específico — `count` directo | 🔴 | invoice-service.ts:329-333 |
| P-A-05 | Nenhum teste de concorrência invoice | 🟡 | inexistente em src/lib/*.test.ts |
| P-A-06 | `runWithTenant` não força nível de isolamento | 🟡 | tenant-db.ts — sem `isolationLevel` especificado |
| P-A-07 | `SoftwareCertificateNumber: '000/AGT/2026'` literal no código | 🔴 | saft-ao.ts:51 |
| P-A-08 | `Invoice.type` e `Invoice.status` são String livres | 🟡 | schema.prisma |

---

## 4. Decisão sobre `InvoiceSeries`

**Recomendado:** criar `InvoiceSeries` como tabela dedicada. **Não reutilizar `BusinessDocumentCounter`.**

**Modelo proposto:**

```
model InvoiceSeries {
  tenantId    String
  series      String           // FT | NC | FR
  year        Int
  lastNumber  Int @default(0)

  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, series, year])
}
```

**Motivo:** a tabela é genuinamente fiscal — semanticamente distinta da facturação comercial ligada ao módulo de documentos. Reusar `BusinessDocumentCounter` introduziria `PROPOSAL`/`QUOTE` no mesmo namespace físico com movimentos fiscais e dificultaria auditorias futuras.

---

## 5. Modelo Prisma final

```
enum InvoiceType { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries { ... }

model Invoice {
  ...
  type        InvoiceType
  status      InvoiceStatus
  number      String

  @@unique([tenantId, type, number])
  @@index([tenantId, issuedAt])
}
```

---

## 6. SQL de backfill — correcto (não executado)

### Fase 1 — Detectar formatos existentes

```sql
SELECT DISTINCT regexp_replace(number, '[0-9]+/[0-9]+$', '') AS prefix,
       COUNT(*) AS count
FROM "Invoice"
GROUP BY 1 ORDER BY 2 DESC;
```

### Fase 2 — Detectar anomalias

```sql
SELECT id, "tenantId", type, number, "issuedAt"
FROM "Invoice"
WHERE number !~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$'
   OR number IS NULL
   OR "issuedAt" IS NULL
ORDER BY "tenantId", "issuedAt";
```

### Fase 3 — Backfill idempotente

```sql
INSERT INTO "InvoiceSeries" ("tenantId", "series", "year", "lastNumber")
SELECT "tenantId", split_part(number, ' ', 1),
       substring(number from '([0-9]{4})')::int,
       MAX(substring(number from '/([0-9]+)$')::int)
FROM "Invoice"
WHERE number ~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$'
GROUP BY "tenantId", split_part(number, ' ', 1),
         substring(number from '([0-9]{4})')::int
ON CONFLICT ("tenantId", "series", "year")
DO UPDATE SET "lastNumber" = GREATEST("InvoiceSeries"."lastNumber", EXCLUDED."lastNumber");
```

---

## 7. Estratégia transaccional

```
BEGIN
  1. Adquirir advisory lock: SELECT pg_advisory_xact_lock(hashtext('invoice-chain:' || tenantId));
  2. InvoiceSeries.upsert — incrementa lastNumber atomicamente; atribui número uma única vez
  3. SELECT ... FROM "Invoice" WHERE tenantId = $1 ORDER BY createdAt DESC FOR UPDATE;
  4. previousHash = lastInvoice.hash
  5. hash = sha256({ ..., previousHash })
  6. Persistir factura com número + hash + previousHash
  7. Atualizar draft de origem
COMMIT
```

---

## 8. Política da cadeia de hash

A cadeia de hash é **global ao tenant**, mesmo entre FT e NC.

**Decisão:** toda emissão corre dentro da mesma transação protegida por `pg_advisory_xact_lock` por tenant.

---

## 9. Estratégia expand-contract

| Fase | Acção | Reversa? |
|---|---|---|
| **Fase 1 — Expansão** | Criar `InvoiceSeries`, novos campos opcionais, enums não-obrigatórios | Sim |
| **Fase 2 — Código dual** | Novo caminho; `count()` mantém-se como fallback com logging | Sim |
| **Fase 3 — Contração** | Remover `count()`; conversão String → ENUM | Não |
| **Fase 4 — Cleanup** | Remover Invoice.series se desnecessário | Sim |

---

## 10. Regras de integridade documental

- Factura emitida: número preservado para sempre, mesmo anulada
- Rollback durante emissão: número devolvido, sem saltos para próxima
- Nota de crédito: número contado em série NC isolada
- Rascunho convertido: exactamente uma única conversão atómica por draft

---

## 11. Matriz de testes

| Cenário | Objectivo | Resultado obrigatório |
|---|---|---|
| 100 emissões simultâneas | 0 duplicados | Zero violações UNIQUE; sequência contígua |
| 50 FT + 50 NC concorrentes | Cadeia linear | previousHash sempre actualizado |
| Falha a meio da emissão | Rollback limpo | Nenhum registro parcial; contador restaurado |
| Anulação posterior | Número preservado | Número permanece para sempre |
| Mudança de ano | Série reinicia | FT 2027/0001 após FT 2026/0099 |
| 2 tenants concorrentes | Isolamento | Invisíveis entre si |
| Repetição da mesma requisição | Idempotência | Sem duplicação de número |
| Falha de transação | Rollback automático | Zero órfãos |
| Timestamp skew | Coerência | Orelhamento em BD encerra pela BD |

---

## 12. Riscos residuais

- `SoftwareCertificateNumber: '000/AGT/2026'` — substituição requer certificado AGT (processo ainda não iniciado no contexto da empresa)
- Nenhum cliente real — staging zero facturas; comportamento sob carga real não exercitado
- Emissões concorrentes não testadas — comportamento inferido até piloto real

---

## 13. Dependências de validação AGT

- Certificado de software AGT (não existente)
- Validação do formato do número (não confirmado)
- Regulamentação SAFT-AO (não validada externamente)

---

## 14. Plano de implementação

### Fase A — Integridade documental

1. PA1 — enum migration (InvoiceType, InvoiceStatus)
2. PA2 — InvoiceSeries migration + backfill (0 rows; produção não assumida vazia)
3. PA3 — refactor `issueInvoice` e `issueCreditNote` sob nova transação com advisory lock
4. PA4 — testes paralelos (100/500) com verifying races
5. PA5 — constraint `@@unique([tenantId, type, number])`

### Fase B — Fiscal

- `SoftwareCertificateNumber` em env var
- Validação AGT antes de emissão comercial

---

## 15. Decisão final: APROVADO COM CONDIÇÕES

1. **Condições:**
   - Nenhuma alteração efectivamente executada durante a fase de análise
   - Antes da implementação: autorização explícita para FASE A
   - Produção: inventário antes de qualquer backfill
2. **Não declarar conformidade AGT** em nenhuma fase até validação externa

**Nenhuma linha de código, schema, migration ou configuração foi executada.**
