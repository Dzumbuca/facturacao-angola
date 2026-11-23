# MACHINE FACTURAS — FASE A0.4
## Arquitectura Final — Integridade documental

**Síntese:** A arquitectura de operação de emissão que Machine Facturas usa hoje é frágil . Esta especificação propõe mudanças bem comportadas em quatro eixos: cadeia de hash ancorada em estado explícito (`InvoiceChainState`), sequência global por tenant (`chainSequence` em `Invoice`), idempotência persistida (nova tabela `IdempotentRequest`), e inicialização atómica do estado da cadeia.

**Âmbito:** apenas especificação. Nenhuma alteração foi executada ao projecto.

---

## 1. Sumário executivo

**Resumo:** a fase A0.3 deixou lacunas importantes (cadeia ancorada em createdAt sem garantia determinística, inicialização insegura do estado, ausência de idempotência persistente). Foram corrigidas nesta especificação. (cadeia ancorada em timestamps, inicialização insegura do ChainState, falta de idempotência para o caso de timeout). Resolvê-las conduz a uma fase A que reduzirá emissão reducible a um clique do ratão.

**Condições:**
- Migração de tipos documentais e actuais (ainda não aplicada)
- Validação AGT externa não incluída — continua dependente da formalização e do certificado de software
- Reconciliação de produção obrigatória antes de qualquer migração

**Maturidade para iniciar a implementação:** aprovada tecnicamente, **APROVADO COM CONDIÇÕES**, sujeitas às condições da secção 14.

---

## 2. Evidências do código actual

| # | Local | Evidência |
|---|---|---|
| 1 | `src/lib/invoice-service.ts:93-97` | `count + 1` para FT |
| 2 | `src/lib/invoice-service.ts:329-333` | `count + 1` para NC |
| 3 | `src/lib/invoice-service.ts:84-89` | `orderBy createdAt DESC` na obtenção do `lastInvoice` |
| 4 | `src/lib/invoice-service.ts:212` | `FOR UPDATE` tardio (após contagem; protege apenas quota) |
| 5 | `src/lib/crypto.ts:24-44` | `generateInvoiceHash` — sha256 canónico dos campos + `previousHash` |
| 6 | `prisma/schema.prisma` | `Invoice` sem `@@unique([tenantId, type, number])` |
| 7 | `src/lib/tenant-db.ts:32-38` | `runWithTenant` não define `isolationLevel` — usa default `READ COMMITTED` |
| 8 | `prisma/schema.prisma` | `Payment.idempotencyKey` `unique([tenantId, idempotencyKey])` |
| 9 | `src/lib/payment-service.ts:15` | reutilização da janela `findUnique` para verificar duplicação |
| 10 | `src/lib/stock-service.ts:121` | `idempotencyKey = 'invoice-' + invoiceId + '-' + product.id` |
| 11 | `saft-ao.ts:51` | `SoftwareCertificateNumber: '000/AGT/2026'` — placeholder |
| 12 | `src/lib/business-document-repository.ts:40-55` | Counter atómica existe e funciona (proforma) — ou seja, **padrão de incremento existe, nãoh utilizado para factura fiscal** |

**Testes de concorrência do código (existentes):** apenas `ad-unlock-core.test.ts` (não relevante para facturação). **Testes inexistentes** para emissão concorrencial. **Limitação:** confirmando que não há mecanismos hoje.

---

## 3. Modelo de sequência global

### 3.1 A cadeia documental não é reconstruível pela numeração fiscal

Documentos fiscais FT e NC são numerados independentemente:
- FT 2026/0001, FT 2026/0002
- NC 2026/0001, NC 2026/0001

Sem ordem global, não é possível saber qual desses documentos foi emitido primeiro Apenas com o hash da factura anterior para previousHash — e se houver bifurcações — não auditado.

### 3.2 Proposta de `chainSequence` em `Invoice`

Campo adicional: `chainSequence Int?` — sequência global ao tenant, incrementada a cada emissão. Facturas emitidas têm `chainSequence NOT NULL`; rascunhos têm `chainSequence NULL`.

Com isto:
- FT 2026/0001 → chainSequence = 1
- NC 2026/0001 → chainSequence = 2
- FT 2026/0002 → chainSequence = 3
- Elemento não ordenáveis → comparação directa

### 3.3 Regras

1. `chainSequence` obrigatório para documentos emitidos
2. `@@unique([tenantId, chainSequence])` — proíbe duplicação
3. Geração atómica no mesmo `UPDATE` que actualiza `InvoiceChainState`
4. Documentos na cadeia = não mesmo

---

## 4. Estratégia de reconstrução

### Reconstrução

1. **Identificar o primeiro documento:** nenhum documento tem `previousHash IS NULL` → `chainSequence == 1`
2. **Validar `previousHash`:** reler para cada incremento; `sha256(items + issuedAt + previousHash)` = documento.hash
3. **Recalcular:** se não for igual — regra que esta factura é corrompida/inventada
4. **Detectar duplicados** por `chainSequence`
5. **Detectar saltos:** `@{next.seq - prev.seq}` != 1 = salto
6. **Detectar conteúdo alterado:** regra anterior
7. **Detectar documento removido:** `chainSequence` pula um valor
8. **Comparar** IDsai colhidos com `InvoiceChainState.lastSequence`

### Recuperação

- **Automática:** reconciliar `InvoiceChainState` com a factura mais recente
- **Manual:** se houver bifurcações (dois nós com mesmo `previousHash`), não reconstruir — pausar o tenant até verificar produção

---

## 5. Numeração fiscal — sem fallback

**Proibido:** `count + 1` em qualquer ramo da aplicação. **Definitivamente REJEITADOS os fallbacks:**

- `count + 1`
- `MAX(number) + 1`
- `COALESCE(MAX(...))+ 1`

**Fluxo permitido:**
- `InvoiceSeries.upsert` → atomically incrementa counter → atribui número
- Contador inexistente → cria com `lastNumber = 1`
- Conflito de unicidade → rollback da transação
- Falha do advisory lock → re-regala mas não experimenta retrials incrementais

---

## 6. Idempotência persistente

### Nome proposto: `IdempotentRequest`

```
model IdempotentRequest {
  tenantId    String
  key         String
  resource    String    // 'INVOICE', 'CREDIT_NOTE', 'PAYMENT_RECEIPT'
  resultId    String?
  payloadHash String    // canonic hash of request body
  createdAt   DateTime  @default(now())

  @@id([tenantId, key])
}
```

**Regras:**
- Unique `[tenantId, key]` — duplicata física
- `resource` distingue invoice de NC — implementação a mesma tabela
- Repetição com mesmo payload → devolve `resultId`
- Repetição com payload diferente → 409 verificação

**Estado:** a mesma tabela já existe como `EmailActionToken` (`tokenHash`), e como `Payment.idempotencyKey` — a tabela proposta é simplesmente dedicada para emissões.

**Aplicar NC também:** basta passar `resource: 'CREDIT_NOTE'`.

---

## 7. Inicialização segura de InvoiceChainState

### Problema original: `SELECT FOR UPDATE` não protege a criação da primeira linha

```sql
-- Falha: nada para bloquear
SELECT * FROM "InvoiceChainState" WHERE "tenantId" = $1 FOR UPDATE;
```

### Solução

Dentro da mesma transação:
```sql
INSERT INTO "InvoiceChainState" ("tenantId", "lastHash", "lastSequence", "lastInvoiceId", "updatedAt")
VALUES ($1, NULL, 0, NULL, NOW())
ON CONFLICT ("tenantId") DO NOTHING;
```

—then SELECT ... FOR UPDATE (existe agora). O INSERT atómica combinado com a advisory lock evita inicializações duplicadas concorrentes.

---

## 8. Advisory lock

PostgreSQL suporta `hashtextextended(text, bigint seed) → bigint` (64 bits) no PGbouncer/Prisma executa `hashtext` (32 bits). Escolhemos **64 bits** via queryRaw:

```sql
SELECT pg_advisory_xact_lock(hashtextextended('invoice-chain:' || $1, 0));
```

**Características:**
- Escopo de transação — liberado automaticamente no commit/rollback
- N instâncias da aplicação interagem com o PostgreSQL; o lock é serializado
- A ordem de aquisição dos locks deve ser consistente (advisory → InvoiceSeries → InvoiceChainState → Invoice) para evitar deadlocks
- hashtextextended pode colisar teoricamente (2⁻⁶⁴ probabilidade por par) — aceite como risco residual

**Ordem fixa de aquisição de locks:** advisory → InvoiceSeries → InvoiceChainState → Invoice. Sem inversão nem reordenação.


---

## 9. Modelo Prisma definitivo

```
enum InvoiceType { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries {
  tenantId     String
  series       String           // 'FT' | 'NC' | 'FR'
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, series, year])
}

model InvoiceChainState {
  tenantId      String   @id
  lastHash      String?
  lastSequence  Int      @default(0)
  lastInvoiceId String?
  updatedAt     DateTime @updatedAt

  tenant        Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model IdempotentRequest {
  tenantId      String
  key           String
  resource      String
  resultId      String?
  payloadHash   String
  createdAt     DateTime @default(now())

  @@id([tenantId, key])
}

model Invoice {
  ...
  type          InvoiceType
  status        InvoiceStatus
  number        String
  chainSequence Int?

  @@unique([tenantId, type, number])
  @@unique([tenantId, chainSequence])
  @@index([tenantId, issuedAt])
}
```

**Justificação:** `InvoiceSeries` lock para o contador fiscal dedicado; `InvoiceChainState` para estado fiscal de cadeia; `IdempotentRequest` para retons de submissões idempotentes; campos novos em `Invoice` minimamente intrusivos.

---

## 10. Fluxo transaccional definitivo

```
BEGIN (runWithTenant)
  1. Validar tenant e permissões; crypto.ensureFormattedKey()
  2. validar `idempotencyKey`:
       - se já existe e `payloadHash` coincide → devolver `resultId` directamente (NO CREATE)
       - se já existe mas `payloadHash` difere → IOC 409 Conflict
  3. acquire advisory lock: pg_advisory_xact_lock(hashtextextended(...));
  4. INSERT InvoiceChainState ON CONFLICT DO NOTHING; SELECT FOR UPDATE chainState;
  5. InvoiceSeries.upsert: incremento lastNumber atomically
  6. Definir chainSequence = chainState.lastSequence + 1
  7. previousHash = chainState.lastHash
  8. hash = generateInvoiceHash(items, previousHash)
  9. Persistir InvoiceChainState (lastSequence += 1; lastHash = hash)
 10. Persistir Invoice (type/status via enum)
 11. IdempotentRequest save (key, resultId=<Invoice.id>)
 12. Converter draft se aplicável (sourceDraftId → ISSUED)
COMMIT / ROLLBACK
```

**Garantia de atomicidade**: lock + upsert + insert + update em uma única transação. Nenhuma emissão sucede.

**Rollback parcial recusado**: se qualquer etapa falhar, a cadeira completa reverte; contador restaurado; InvoiceChainState restaurado; nada emite.

---

## 11. Migração histórica

### Etapa 1 — Diagnóstico

```
SELECT DISTINCT regexp_replace(number, '[0-9]+$', '') AS prefix, COUNT(*) FROM "Invoice" GROUP BY 1;
```

### Etapa 2 — Validar histórico

```
SELECT tenantId, type, number, COUNT(*) FROM "Invoice" GROUP BY 1,2,3 HAVING COUNT(*) > 1 ORDER BY 1;
```

### Etapa 3 — Bifurcações da cadeia pré-existente

Detectar dois documentos com `previousHash` igual.

### Etapa 4 — Produzir InvoiceChainState para historical data

Só enquanto houver historial validado — para produção vazia, conjunto `lastSequence=0`.

### Etapa 5 — Convergir

Se houver documento anómalo → bloqueio total até manufatura se destacar.

---

## 12. Política de integridade documental

- Factura emitida (status=ISSUED): número e `chainSequence` imutáveis
- Factura anulada: número preservado; estado congelado
- Draft convertido: exactamente uma conversão por draft
- Hash: imutável

---

## 13. Matriz de testes obrigatórios

| # | Cenário | Preparação | Esperado | Critério |
|---|---|---|---|---|
| 1 | 100 emissões simultâneas mesmo tenant | mock writer | linear | séquence exclusively 1..100 |
| 2 | 500 emissões simultâneas | mock writer | linear | zero violação UNIQUE |
| 3 | FT e NC concorrentes | executores separados | cadeia linear | cadeia sem bifurcação |
| 4 | 2 instâncias app | controllers | cadeia sempre contígua | cadeia always sealed |
| 5 | 2 tenants concorrentes | multi-tenant bath | isolamento total | zero cross-tenant |
| 6 | Repetição de requisição | 1 chaining | exactamente 1 emissão | 1 factura |
| 7 | Mesma key com conteúdo diferente | poisoned request | 409 conflict | request rejected |
| 8 | Timeout cliente | disconnect mid-call | exatamente 1 emissão | 1 factura |
| 9 | Rollback após reservar número | injection | contador restaurado | no orphan |
| 10 | Rollback após gerar hash | injection | cadeia restaurada | zero documento exíll |
| 11 | Falha ao actualizar ChainState | injection | rollback total | zero orphan |
| 12 | Inicialização simultânea do primeiro ChainState | racing | exactamente 1 inicialização | 1 row always |
| 13 | Sequência duplicada | seeded collision | REJECT | 409 |
| 14 | Documento removido | DELETE histórico | detectável | 409 ou alert |
| 15 | Hash alterado manualmente | tamper test | detectável | alert mandatory |
| 16 | Reconstrução integral | verify run | linear | change detection |
| 17 | Anulação posterior | lifecycle real | número preservado | number imutável |

---

## 14. Riscos residuais

- `SoftwareCertificateNumber: '000/AGT/2026'` — placeholder; não afecta arquitectura — processo AGT separado
- Produção não assumida vazia — inventário antes de backfill
- Migração nunca executada em produção

---

## 15. Plano de implementação

### Fase A — Integridade fiscal (≈ 2-3 semanas)

1. PA1 — Migration (NOT EXEC, plan persisted): `InvoiceSeries`, `InvoiceChainState`, `IdempotentRequest`, enums
2. PA2 — Código dual — novo caminho ativo; antigo fallback com logging
3. PA3 — Testes 100/500 conforme matriz
4. PA4 — Constraint @@unique([tenantId, type, number]) e @@unique([tenantId, chainSequence])
5. PA5 — Limpeza

### Fase F — AGT (dependem do … externo)

Fora de âmbito — aprovação AGT externa

---

## 16. Decisão final

**A arquitectura está pronta para implementação em staging?**  
Sim, desde que tenha:
1. Autorização escrita para a criação de migrations em staging
2. Inventário de produção (SELECT DISTINCT type, status FROM "Invoice") antes de produção

**Aprovação técnica ≠ conformidade AGT.** AGT: certificado de software obrigatório, processo não iniciado.

**Nenhuma linha de código, schema, migração ou configuração foi executada nesta fase.**

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 329-333, 212; crypto.ts:24; tenant-db.ts; payment-service.ts:15; stock-service.ts:121; payment-service.ts:31; informed-payment/route.ts
- **CONFIRMADO NA BASE DE DADOS:** zero facturas em staging; 0 linhas em BusinessDocumentCounter; 3 warehouses; 182 stock movements
- **CONFIRMADO POR TESTES ACTUAIS:** crypto.test.ts (hash chaining); ad-unlock-core.test.ts (para referência)
- **INFERÊNCIA TÉCNICA:** comportamento sob carga — apenas desenhado, jamais executado nesta fase
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT — certificado de software, validação SAFT-AO
