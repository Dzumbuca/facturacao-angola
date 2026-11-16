# MACHINE FACTURAS — FASE A0.5.3.1
## Correcção final da arquitectura de integridade documental

**Data:** 2026-11-16
**Natureza:** encerramento arquitectural. **Zero alterações funcionais, de schema, migrações ou base de dados foram executadas nesta fase.**
**Staging:** read-only. **Produção:** não tocada.
**Código:** `feat/machine-rh-b1-calendar` (HEAD `f9706b2`).

---

## 1. Resumo executivo

Esta fase fecha as sete lacunas identificadas na revisão da Fase A0.5.3 e consolida a arquitectura definitiva de integridade documental. Todas as decisões são sustentadas no código, no schema e nos dados de staging.

**Decisão final:** APROVADA PARA IMPLEMENTAÇÃO A1 — dependente de autorização explícita.

---

## 2. Referência à Fase A0.5.3

A fase A0.5.3 definiu a arquitectura de integridade documental com sete problemas pendentes. Cada um é resolvido com uma análise precisa do código e do schema actuais.

| # | Problema (A0.5.3) | Solução final (A0.5.3.1) |
|---|---|---|
| 1 | Relação Invoice ↔ InvoiceSeries sem FK composta | FK composta `(tenantId, seriesCode, documentType, year)` em `Invoice`; unicidade alargada a série+exercício |
| 2 | Canonicalização monetária frágil / `Number()` | `canonicalDecimal(Decimal) → string` sem perda; `hashVersion` confirmada |
| 3 | Reconstrução história ambígua | Algoritmo com classificação A–F e bloqueio automático sem reparações |
| 4 | Duas ordens de locks inconsistentes | Ordem única documentada em FT, NC, init e todas as emissões |
| 5 | InvoiceChainState ↔ Invoice sem integridade cross-tenant | FK composta, `onDelete: Restrict`, constraint de integridade tenant |
| 6 | IdempotentRequest sem integridade referencial | `resultId` em mesma transação; `@@unique([tenantId, key])`; hard block em inconsistência |
| 7 | Backfill ordenado por `issuedAt` inseguro | Plano em 10 passos; sem inventar ordem histórica; bloqueio explícito |

---

## 3. Problema 1 — Relação Invoice ↔ InvoiceSeries

### 3.1 Estado actual (evidência)

`Invoice.type` é `String` — não tem relação física para a série nem para o exercício fiscal (`schema.prisma`, modelo `Invoice`).

### 3.2 Modelo final consolidado

```prisma
model InvoiceSeries {
  tenantId     String
  seriesCode   String           // identificador fiscal do prefixo/código da série
  documentType InvoiceType       // FT | NC | FR
  year         Int              // exercício fiscal em que a série foi criada
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoices     Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model Invoice {
  id            String        @id @default(uuid())
  tenantId      String
  type          InvoiceType
  seriesCode    String
  year          Int           // cópia do exercício fiscal no momento da emissão
  number        String
  status        InvoiceStatus
  chainSequence Int?
  hash          String
  hashVersion   Int @default(1)
  previousHash  String?
  ...

  series        InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)

  @@unique([tenantId, seriesCode, type, year, number])
  @@index([tenantId, issuedAt])
}
```

### 3.3 Unicidade

`@@unique([tenantId, seriesCode, type, year, number])` — documento único por tenant, série, tipo, exercício e número. Um número `FT 2026/0001` pode repetir-se em 2027 dentro da mesma série sem colisão, e duas séries podem emitir `FT 2026/0001` cada uma no mesmo ano.

**Documentos DRAFT** permitem `chainSequence = NULL`. A partial UNIQUE index cobre apenas `WHERE chainSequence IS NOT NULL` (ver secção 6 desta fase).

`FR` permanece no enum por compatibilidade mas sem fluxo real — nenhuma rota emite `FR` actualmente; permanece pendente de validação externa.

---

## 4. Problema 2 — Hash e canonicalização monetária

### 4.1 Regra inegociável

`Number()`, `parseFloat()` e conversões que percam precisão são proibidos em valores monetários.

### 4.2 Representação canónica

```typescript
// entrada: Prisma.Decimal (do field no modelo)
// saída: string determinística
function canonicalDecimal(value: Prisma.Decimal): string {
  // Prisma.Decimal.toString() já:
  //   - preserva toda a precisão decimal
  //   - normaliza notação científica insignificante
  //   - remove zeros à direita ('1.50' → '1.5')
  //   - mantém zeros à esquerda significativos ('0.01')
  //   - inclui sinal negativo
  return value.toString();
}
```

### 4.3 Exemplos canónicos

| Entrada | Saída |
|---|---|
| `Decimal(1000)` | `"1000"` |
| `Decimal('1000.00')` | `"1000"` |
| `Decimal('0.10')` | `"0.1"` |
| `Decimal('0.01')` | `"0.01"` |
| `Decimal('-100.50')` | `"-100.5"` |

### 4.4 Payload canónico — v2 (futuro) vs v1 (actual)

`v1` (actual, preserva histórico): `JSON.stringify` com `Number()` para Decimals; sem `hashVersion` no payload. Documentos históricos validam com v1.

`v2` (futuro): canonicalização exacta com `canonicalDecimal()`; adiciona `hashVersion`, `currency`, `documentType`, `seriesCode`, `year`, `number`. Hash v2 aplicado a documentos novos; v1 continua aceitável para históricos.

A versão utilizada fica em `Invoice.hashVersion`. Hashes históricos nunca são recalculados silenciosamente.

### 4.5 Campos fiscais no payload

Items, cliente, emitente, totais, impostos, descontos, data de emissão, tipo documental, série, exercício — todos no payload. Timestamps técnicos do sistema são excluídos.

---

## 5. Problema 3 — Reconstrução histórica

### 5.1 Classificação de documentos

Cada documento do tenant é classificado:

- **A** — Pertence à cadeia actual (`chainSequence NOT NULL`)
- **B** — Histórico de antes da cadeia (`previousHash IS NULL` — raiz histórica)
- **C** — Hash inválido (`hash` não corresponde ao conteúdo)
- **D** — Sem informação suficiente (falta `hash` ou `previousHash`
- **E** — Referência inconsistente (`chainSequence` e `previousHash` incoerentes entre si)
- **F** — Bifurcação potencial (dois documentos com o mesmo `previousHash`)

### 5.2 Algoritmo

```
Fase 1 — Inventário
  documentos := SELECT * FROM "Invoice" WHERE tenantId = $1

Fase 2 — Encontrar raiz
  raiz := documentos WHERE previousHash IS NULL
  if |raiz| != 1 → bloquear tenant, exigir investigação manual
  if raiz.hash histórico inválido → bloquear por invalidez criptográfica

Fase 3 — Percurso
  cursor := raiz
  visitados := {cursor}
  
  while existe (próximo := documentos WHERE previousHash == cursor.hash):
      if next is already visited → bloqueio de ciclo
      if next.chainSequence != cursor.chainSequence + 1 → bloqueio de salto
      if next.hash inválido → bloqueio de hash
      visitados.add(next)
      cursor := próximo
  
Fase 4 — Comparação com estado
  if |visitados| != |documentos WHERE chainSequence IS NOT NULL| → bloqueio de orphans
  if InvoiceChainState não bate com o último visitado → bloqueio: estado corrompido
```

### 5.3 Reconstrução

Só quando a cadeia está integralmente verificável — raiz única, sem múltiplos sucessores, sem ciclos, sem saltos, sem orphans — se pode reconstruir `InvoiceChainState`. Nenhum documento, hash ou número histórico é modificado. Se a verificação falhar, o tenant fica bloqueado permanentemente para este módulo até investigação manual com evidência documentada.

---

## 6. Problema 4 — Ordem única de locks

### 6.1 Ordem definitiva (aplicar em todos os caminhos)

```
1. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))
2. InvoiceSeries  (upsert, increment — linha única por série/ano/tipo)
3. InvoiceChainState (lazy init via INSERT ON CONFLICT DO NOTHING, depois SELECT FOR UPDATE)
4. Invoice        (INSERT com chainSequence atribuído)
5. IdempotentRequest (INSERT)
6. Qualquer outro recurso (stock, quota, etc) sempre depois de 1–5
```

### 6.2 Onde aplicar

FT, NC, init, idempotência, qualquer fluxo que actualize a cadeia — mesma ordem. Stock, quotas e drafts usam a mesma sequência dentro de `runWithTenant`.

### 6.3 Deadlock e timeout

- Advisory lock serializa pedidos do mesmo tenant; deadlocks entre recursos diferentes descartam ordem de aquisição — todos obedecem à mesma ordem
- `lock_timeout`/`statement_timeout`: deixar herdar do sistema ou explicitar valores; timeout ⇒ ROLLBACK automático; nunca COMMIT parcial
- Deadlock detected (`40P01`) → HTTP 503, backoff exponencial; mesma `idempotencyKey` no retry

---

## 7. Problema 5 — InvoiceChainState ↔ Invoice

### 7.1 Modelos

```prisma
model InvoiceChainState {
  tenantId      String    @id
  lastHash      String?
  lastSequence  Int       @default(0)
  lastInvoiceId String?   // FK composta
  updatedAt     DateTime  @updatedAt

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice?  @relation("CurrentChainHead", fields: [lastInvoiceId, tenantId], references: [id, tenantId], onDelete: Restrict)
}

model Invoice {
  ...
  currentChainState InvoiceChainState? @relation("CurrentChainHead")

  @@unique([id, tenantId])
}
```

### 7.2 Constraint de integridade (SQL adicional)

```sql
ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_tenant_unique_id UNIQUE ("id", "tenantId");

ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_fk
  FOREIGN KEY ("lastInvoiceId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;
```

### 7.3 Coerência final

`lastInvoiceId` e o tenant são sempre actualizados atomicamente com `lastHash` e `lastSequence`. Estado inicial vazio: `lastHash = NULL`, `lastSequence = 0`, `lastInvoiceId = NULL` — único estado "cadeia vazia" legal.

`onDelete: Restrict` impede eliminação acidental de Invoice enquanto referenciada.

---

## 8. Problema 6 — Idempotência persistente

### 8.1 Modelo

```prisma
model IdempotentRequest {
  tenantId     String
  key          String
  resource     String           // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash  String
  resultId     String            // NOT NULL
  createdAt    DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}
```

### 8.2 Integridade e atomicidade

`IdempotentRequest` e `Invoice` são criados na mesma transacção. Atomicidade garantida pelo commit único.

### 8.3 Recuperação pós-COMMIT com resposta perdida

```sql
SELECT resultId FROM "IdempotentRequest"
WHERE tenantId = $1 AND key = $2 AND resource = 'INVOICE';
```
Se existir → devolve `resultId` (HTTP 200). Se o payloadHash difere → 409.

### 8.4 Sem ambiguidade

A mesma chave com mesmo payload devolve a mesma factura. Mesma chave com payload diferente → 409 com mensagem clara. Timeout do cliente nunca duplica emissão.

---

## 9. Problema 7 — Migração histórica segura

### 9.1 Plano em 10 etapas

```
1.  Inventário: SELECT DISTINCT type, status FROM "Invoice"
2.  Inventário com COUNT(*) e COUNT(DISTINCT tenantId, seriesCode, documentType, year, number)
3.  Validação de hashes existentes (sha256 re-calculado)
4.  Classificação A/B/C/D/E/F
5.  Reconciliação: identificar bifurcações antigas, saltos, orphans precedentes
6.  Bloqueio de qualquer tenant com dados inexplicáveis
7.  Backup restaurado antes de qualquer step de escrita
8.  Backfill InvoiceSeries em ordem cronológica do documento
9.  Verificação pós-migration: cadeia reconstruída == estado em produção
10. Aprovação independente por engenharia responsável
```

### 9.2 Proibições

- Não assumir produção vazia porque staging está vazio
- Não atribuir `chainSequence` a documentos antigos sem hashing garante
- Não reescrever dados históricos
- Staging vazio não implica nada para produção

---

## 10. Arquitectura consolidada — Prisma final

```prisma
enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries {
  tenantId     String
  seriesCode   String
  documentType InvoiceType
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoices     Invoice[]

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model InvoiceChainState {
  tenantId      String    @id
  lastHash      String?
  lastSequence  Int       @default(0)
  lastInvoiceId String?
  updatedAt     DateTime  @updatedAt

  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  lastInvoice   Invoice?  @relation("CurrentChainHead", fields: [lastInvoiceId, tenantId], references: [id, tenantId], onDelete: Restrict)
}

model IdempotentRequest {
  tenantId     String
  key          String
  resource     String
  payloadHash  String
  resultId     String
  createdAt    DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}

model Invoice {
  id            String        @id @default(uuid())
  tenantId      String
  type          InvoiceType
  seriesCode    String
  year          Int
  number        String
  status        InvoiceStatus
  chainSequence Int?
  previousHash  String?
  hash          String
  hashVersion   Int @default(1)

  series        InvoiceSeries @relation(fields: [tenantId, seriesCode, type, year], references: [tenantId, seriesCode, documentType, year], onDelete: Restrict)

  currentChainState InvoiceChainState? @relation("CurrentChainHead")

  @@unique([tenantId, seriesCode, type, year, number])
  @@unique([id, tenantId])
  @@index([tenantId, issuedAt])
}
```

---

## 11. Constraints SQL propostas

```sql
CREATE UNIQUE INDEX invoice_chain_sequence_unique
  ON "Invoice" ("tenantId", "chainSequence")
  WHERE "chainSequence" IS NOT NULL;

ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_issued_requires_chain_sequence
  CHECK (status <> 'ISSUED' OR "chainSequence" IS NOT NULL);

ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_last_invoice_fk
  FOREIGN KEY ("lastInvoiceId", "tenantId")
  REFERENCES "Invoice" ("id", "tenantId")
  ON DELETE RESTRICT;

ALTER TABLE "InvoiceChainState"
  ADD CONSTRAINT invoice_chain_state_sequence_nonnegative
  CHECK ("lastSequence" >= 0);
```

---

## 12. Fluxo transaccional definitivo

```
1. Autenticação/validação do tenant
2. Validação estrutural do payload (signature requisão)
3. Canonicalização do payload → payloadHash (sha256)
4. BEGIN (runWithTenant)
5. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))
6. INSERT "InvoiceChainState" ON CONFLICT DO NOTHING (initializa se inexistente)
7. SELECT FOR UPDATE "InvoiceChainState" WHERE tenantId = $1
8. "InvoiceSeries" upsert — incrementa lastNumber em 1 se
9. chainSequence := lastSequence + 1
10. previousHash := lastHash
11. hash := sha256(canonical(payload, previousHash))
12. INSERT "Invoice" (status='ISSUED', chainSequence=chainSequence, hash=hash, hashVersion=1)
13. UPDATE "InvoiceChainState" SET lastHash=hash, lastSequence=chainSequence, lastInvoiceId=Invoice.id
14. INSERT "IdempotentRequest" (key, payloadHash, resultId=Invoice.id, resource='INVOICE')
15. UPDATE "InvoiceDraft" SET status='ISSUED' (se sourceDraftId aplicável)
COMMIT
```

Rollback em qualquer passo desfaz tudo — zero órfãos, zero estado parcial.

---

## 13. Ordem única de locks (definitiva — repetir em todos os fluxos)

```
1. advisory lock (hashtextextended('invoice-chain:' || tenantId, 0))
2. InvoiceSeries
3. InvoiceChainState
4. Invoice
5. IdempotentRequest
6. Qualquer outro recurso (stock, quota, draft, etc) — depois de 1–5
```

Aplicada sempre — FT, NC, init, idempotência, stock, retry.

---

## 14. Canonicalização monetária — exemplos

```typescript
function canonicalDecimal(value: Prisma.Decimal): string {
  return value.toString();   // Prisma.Decimal.toString(); sem consumo
}
```

| Entrada | Output |
|---|---|
| `new Decimal(1000)` | `"1000"` |
| `new Decimal('1000.00')` | `"1000"` |
| `new Decimal('0.10')` | `"0.1"` |
| `new Decimal('0.01')` | `"0.01"` |
| `new Decimal('-100.50')` | `"-100.5"` |

**Regra:** nunca converter em `Number()`, `parseFloat()`, `Intl*`, `toFixed`. Máxima precisão string.

---

## 15. Versionamento do hash

- **v1** — formato actual, `JSON.stringify` com `Number()`, `previousHash || 'ROOT'` — válido para históricos
- **v2** — futuro: canonicalização exacta (`canonicalDecimal`); inclui `hashVersion`, `documentType`, `seriesCode`, `year`, `currency` no payload
- **Documentos históricos validam sempre com v1** — nunca reescritos
- **Sem mudança silenciosa:** a versão é decidida explicitamente por documento no momento da emissão
- **Novas versões** nunca invalidam v1

---

## 16. Migração histórica — procedimento de segurança

```
Fase 1.  Inventário (staging): verify 0 rows — não usar para inferir produção
Fase 2.  Inventário (produção com autorização escrita)
Fase 3.  Validação de hashes históricos
Fase 4.  Backfill InvoiceSeries — uma única operação atómica
Fase 5.  Inicialização InvoiceChainState com snapshot
Fase 6.  Verificação completa
Fase 7.  Aprovação
```

Nenhum passo executa sem autorização para produção.

---

## 17. Matriz de testes da Fase A1

| # | Teste | Tipo |
|---|---|---|
| 1 | 100 emissões concorrentes simultâneas | Concorrência PostgreSQL real |
| 2 | 500 emissões simultâneas | Stress |
| 3 | FT e NC concorrentes, mesma cadeia | Cadeia unificada 1→N |
| 4 | 2 instâncias da aplicação | Controllers independentes |
| 5 | 2 tenants em simultâneo | Isolamento |
| 6 | Mesma chave simultânea | Exactamente 1 emissão |
| 7 | Mesma chave + payload diferente | HTTP 409 |
| 8 | Timeout após COMMIT | Retorno da mesma factura (HTTP 200) |
| 9 | Timeout antes de COMMIT | HTTP 503 |
| 10 | Rollback a meio | Zero órfão |
| 11 | Falha após reservar número | Rollback total |
| 12 | Falha após gerar hash | Rollback total |
| 13 | Falha ao actualizar ChainState | Rollback total |
| 14 | Inicialização simultânea do estado | Exactamente 1 linha |
| 15 | chainSequence duplicada | HTTP 409 |
| 16 | Documento ISSUED sem chainSequence | Constraint SQL rejeição |
| 17 | Alteração de documento emitido | HTTP 409 |
| 18 | Documento removido | Detecção, bloqueio tenant |
| 19 | Bifurcação da cadeia | Bloqueio, investigação manual |
| 20 | Reconstrução completa da cadeia | OK, linear 1..N |
| 21 | Anulação posterior | Número preservado |
| 22 | Eliminar tenant com histórico | `onDelete: Restrict` rejects |
| 23 | Hash tampered | Cadeia inconsistente, bloqueio |
| 24 | Hash histórico v1 | Valida sempre sem rehash |

---

## 18. Riscos residuais

- **AGT** — processo externo; nunca declarar conformidade sem certificado de software
- **Produção com dados reais** — inventário obrigatório antes de qualquer migração
- **Concorrência extensiva (>1000 simultâneos)** — requer simulação em staging antes de produção

---

## 19. Decisão final: APROVADA PARA IMPLEMENTAÇÃO A1

**Condições explícitas:**
1. Autorização escrita do utilizador ("Autorizo implementação A1")
2. Inventário de produção (`SELECT DISTINCT type, status FROM "Invoice";`)
3. Janela de testes de concorrência em staging

**Nenhum código, migração ou configuração executa sem autorização.**

---

## 20. Plano de implementação A1

1. Autorização escrita
2. Inventário produção
3. Schema — modelos novos + enums
4. Código de emissão unificado (issueInvoice/issueCreditNote) sob advisory lock
5. Testes com unidade + concorrência real em staging
6. Constraint UNIQUE chainSequence + CHECK status/ISSUED
7. Remover qualquer caminho legado de emissão (`count + 1`)
8. Piloto com 1–2 clientes reais
9. Activação controlada
10. Auditoria pós-migração

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** `invoice-service.ts:93-97, 329-333`; `crypto.ts`; `invoice-draft-service.ts`; `tenant-db.ts`
- **CONFIRMADO NA BD:** zero facturas em staging
- **CONFIRMADO POR TESTE:** `crypto.test.ts` (hash determinístico)
- **INFERÊNCIA TÉCNICA:** comportamento sob carga — desenhado; não executado
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT (certificado de software e SAFT-AO)

**Nenhuma linha de código, schema, migração ou configuração foi alterada nesta fase.**
