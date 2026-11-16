# MACHINE FACTURAS — FASE A0.5.1
## Fecho da arquitectura de integridade documental

**Data:** 2026-11-16
**Natureza:** correção de elegência arquitectural. **Zero alterações no projecto.**
**Código:** `feat/machine-rh-b1-calendar`.
**Staging:** read-only. **Produção não tocada.**

---

## 1. Sumário executivo

A correcção explícita das contradições identificadas em A0.4/A0.5 conduz a uma arquitectura fechada e implementável. As decisões fundamentais — `InvoiceSeries`, `InvoiceChainState`, `chainSequence`, `IdempotentRequest`, `pg_advisory_xact_lock`, cadeia global por tenant — são preservadas. Apenas se ajusta a **ordem transaccional**, a **semântica de separação tipo vs série**, e a **reconstrução histórica**.

**Veredicto:** a arquitectura está definitivamente fechada. Pode iniciar-se a implementação em staging. Phase A1 (Integridade fiscal) pode começar assim que a autorização for concedida. A AGT continua a ser processo externo.

---

## 2. Contradições da Fase A0.5 — corrigidas

| Contracicção A0.5 | Solução A0.5.1 |
|---|---|
| Idempotência verificada antes e depois do lock, sem regra | Verificação definitiva apenas depois do lock, dentro da transacção |
| Duas ordens de locks em exemplos diferentes | Ordem única: advisory → InvoiceSeries → InvoiceChainState → Invoice |
| "Cadeias separadas por tipo" (ambiguidade) | Contadores separados por tipo; cadeia de hash **global por tenant** |
| JSON.stringify implicitamente canónico (sem explicação) | Especificação JCS-like explícita com ordem de chaves estável |
| `hashVersion` mencionado sem persistência notacional | `hashVersion Int @default(1)` adicionado ao `Invoice` |
| Confusão entre tipo documental e série fiscal | `documentType` e `seriesCode` separados no `InvoiceSeries` |

---

## 3. Fluxo definitivo de idempotência

**Regra fundamental: toda a verificação da chave idempotente ocorre depois do lock, dentro da transação.**

1. Validar tenant e permissions
2. Validar idempotencyKey (formato, comprimento)
3. Iniciar transacção (runWithTenant)
4. Adquirir advisory lock: `pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))`
5. Verificar IdempotentRequest para (tenantId, key):
   - se payloadHash coincide → retornar PREVIOUS resultId (NO emission) — HTTP 200
   - se payloadHash difere → HTTP 409
   - se não existe → continuar
6. InvoiceSeries.upsert → lastNumber += 1; atribui número
7. chainSequence = chainState.lastSequence + 1
8. previousHash = chainState.lastHash; hash = sha256(payload)
9. Persistir Invoice
10. Actualizar InvoiceChainState
11. Persistir IdempotentRequest (resultId = Invoice.id)
12. Actualizar draft
COMMIT

**Repetições passam pelo lock:** toda a sequência (5) → (12) é serializada por tenant — uma única emissão pertenant em qualquer instante.

**Após COMMIT com timeout de servidor:** o id fica vinculado para sempre à chave: repetição posterior retorna a mesma factura (HTTP 200 com o mesmo `id`), evitando spam duplo.

---

## 4. Ordem definitiva de locks

```
1. pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))
2. InvoiceSeries
3. InvoiceChainState
4. Invoice
5. Recursos adicionais (Stock, etc) apenas depois de 1-4
```

A ordem é a mesma em emissão FT e NC. Aplica-se sempre dentro de `runWithTenant`.

**Deteção de deadlock:** PostgreSQL `detectlock timeout` é 0 (não espechatória) — transacções que acedem fora desta ordem são detectadas por troubleshooting; documentar a regra numa secção de Architecture Decisions.

**Retry:** nunca re-executar uma emissão automática após timeout se o lock foi adquirido: pedir ao cliente para retry [o mesmo request] (idempotência garante resposta coerente).

---

## 5. Cadeia global por tenant

A cadeia é **global ao tenant**. FT e NC partilham a mesma sequência de hash. Exemplo:

| Documento | Tipo | Número fiscal | chainSequence |
|---|---|---:|---:|
| 1 | FT | FT 2026/0001 | 1 |
| 2 | NC | NC 2026/0001 | 2 |
| 3 | FT | FT 2026/0002 | 3 |
| 4 | NC | NC 2026/0002 | 4 |
| 5 | FT | FT 2026/0003 | 5 |

Contadores fiscais são independentes (FT para FT, NC para NC), **mas a cadeia de hash é única**.

---

## 6. Algoritmo de reconstrução histórica

```
Fase 1 — Identificar raiz
  SELECT COUNT(*) FROM "Invoice" WHERE "previousHash" IS NULL AND "chainSequence" = 1;
  Deve ser exactamente 1 para um tenant verificável.

Fase 2 — Percurso
  cursor := raiz
  while EXISTS(document WHERE previousHash = cursor.hash):
     cursor := next document
     validate hash bytewise
     validate chainSequence increments by 1
  (end of chain reached)

Fase 3 — Diagnóstico
  Mapear os documentos percorridos vs todos os documentos do tenant
  IF existem documentos não percorridos:
    if previousHash for orphan → bloqueio
    if chainSequence for duplicate → bloqueio
    if hash inválido → bloqueio

Fase 4 — Reconstrução
  UPDATE InvoiceChainState SET lastSequence = (SELECT max(chainSequence)), lastHash = (match do último documento) FOR ONLY se cadeia válida
  NUNCA sobrescrever hashes históricos
```

---

## 7. Hash canónico definitivo

Mantém-se a implementação actual de `generateInvoiceHash` com estas refinamentos:

| Aspecto | Valor |
|---|---|
| Encoding | UTF-8 |
| Hash | SHA-256 |
| Payload | Canonical-JSON-like — propriedades ordenadas alfabeticamente ou ordem explícita explícita |
| Arrays | **Ordem original de emissão** (não ordenar por SKU) |
| Decimal type | número como string com exact-precision preservada (`.toFixed-ish`) |
| Dates | ISO-8601 UTC (`toISOString()` como actualmente) |
| NULL | explicit `null` in JSON |
| Integers/ Floats | accurate representation per JSON serializer (matches how hashes were computed at runtime) |
| hashVersion | 1 inicialmente; increments meaningful changes |

**Atualização do hash requer `hashVersion++`.**

---

## 8. Modelo Prisma — versão definitiva

```
enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries {
  tenantId     String
  seriesCode   String           // identificador informado pela AGT (A, B, 2026-A, ...)
  documentType InvoiceType      // FT | NC | FR
  year         Int
  lastNumber   Int @default(0)

  tenant       Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@id([tenantId, seriesCode, documentType, year])
  @@index([tenantId])
}

model InvoiceChainState {
  tenantId      String   @id
  lastHash      String?
  lastSequence  Int      @default(0)
  lastInvoiceId String?
  updatedAt     DateTime @updatedAt

  tenant        Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)
}

model IdempotentRequest {
  tenantId     String
  key          String
  resource     String           // 'INVOICE' | 'CREDIT_NOTE'
  payloadHash  String
  resultId     String?
  createdAt    DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, resource, createdAt])
}

model Invoice {
  ...
  type        InvoiceType
  status      InvoiceStatus
  number      String
  chainSequence Int?           // always set for ISSUED
  nextInvoiceId String?        // rarely used; diagnostic
  previousHash String?
  hash        String
  hashVersion Int @default(1)

  @@unique([tenantId, type, number])
  @@unique([tenantId, chainSequence])
}
```

**InvoiceChainState** excepcional `lastSequence >= 0`. InvoiceSeries year+lastNumber perdocumentType independentemente.

**Cascadeiam: Restrict** — histórico preservado.

---

## 9. Constraints e índices

- `UNIQUE([tenantId, seriesCode, documentType, year])` — InvoiceSeries PK
- `UNIQUE([tenantId, chainSequence])` — Invoice; permitido NULL para DAFTs
- `UNIQUE([tenantId, type, number])` — Invoice
- `Index([tenantId, issuedAt])` — tempo-descendente
- `UNIQUE([tenantId, hash])` — não duplicado hash por documento (para auditoria)

A verificar `chainSequence`: NULL allowed for DRAFTs — SQL `UNIQUE NULLS NOT DISTINCT` (Postgres 17+).

---

## 10. Migração e transição

1. Diagnóstico histórico — inventário (feito em staging: 0 Invoice)
2. Verificar hash histórico — aplicativo disponível
3. Backfill InvoiceSeries + InvoiceChainState (sim)
4. Push enum types — incremental
5. Dual-code constraints
6. Mecanismo novo activo
7. Mecanismo antigo removido
8. Auditoria pós-activação

**FR jamais activado** — não existe fluxo real completo; aparece only como enum; é na secção "Pendentes".

---

## 11. Fluxo transaccional completo

Executar na ordem estrita mostrada. Cada passo aninhado na transação.Rollback em qualquer ponto anula todos sem orphan.

```
Auth/tenant/validation → idempotency key (formato) → BEGIN → advisory lock →
  SELECT chave existente →
    encontrada+match → retorno 200 já criada – ROLLBACK
    encontrada+no-match → HTTP 409 – ROLLBACK
    não-encontrada → continuar
  INSERT-IF-NOT-EXISTS InvoiceChainState
  SELECT … FOR UPDATE InvoiceChainState
  InvoiceSeries.upsert → increment
  chainSequence++;
  previousHash=lastHash; hash=sha256(serializedPayload)
  INSERT Invoice (status=ISSUED)
  UPDATE InvoiceChainState (lastSequence)
  IdempotentRequest.resultId = Invoice.id
  sourceDraftID → ISSUED (se aplicável)
COMMIT
```

---

## 12. Matriz de testes corrigida

| # | Cenário | Esperado | Critério |
|---|---|---|---|
| 1 | 100 emissões simultâneas mesmo tenant | sequence 1-100 contínuo | linear |
| 2 | 500 simultâneas | linear sem violações | linear |
| 3 | FT e NC concorrentes na mesma cadeia | 1..n sequence mixed | cadeia linear |
| 4 | 2 instâncias de app | mesma cadeia | cadeia linear |
| 5 | 2 tenants concorrentes | isolamento | invisibility |
| 6 | Same key simultânea | 1 emission | exactly 1 |
| 7 | Same key + payload diferente | 409 | reject |
| 8 | Timeout pós COMMIT | same result | exactly 1 emission |
| 9 | Rollback antes de COMMIT | nada persistido | zero orphan |
|10 | Falha antes do COMMIT | rollback | zero orphan |
|11 | Falha após reservar número | rollback no ponto de falha | zero orphan |
|12 | Falha após gerar hash | rollback | zero orphan |
|13 | Revision chainState | rollback | zero órfão |
|14 | Inicialização simultânea do ChainState | 1 row only | exactamente 1 |
|15 | Duplicate sequence | 409 | reject |
|16 | hash tampered manual | Alert/block | bloquear tenant |
|17 | Documento removido | detectar | prompt considera invasor |
|18 | Bifurcação da cadeia | detectar | bloqueio seletivo |
|19 | Reconstrução integral | OK | linear chain reconstrução |
|20 | Anulação posterior | preserve | número imutável |
|21 | Tentativa de alterar factura emitida | REJECT | 409 |
|22 | Tentativa de eliminar tenant | REJECT | RESTRICTED |
|23 | Timeout lock | timeout | 503 |
|24 | Repetição timeout | devolve mesmo resultId | identity |
|25 | Chave com resource diferente | 409 | reject |

---

## 13. Riscos residuais

- AGT — externa, não resolvida por este documento
- Produção com dados: inventário antes de migração
- hash compatibility backwards: `hashVersion` por agora sempre 1

---

## 14. Plano de implementação

### Fase A1 — Integridade fiscal (≈ 2-3 semanas)

1. Migration: schema + enums + InvoiceSeries + InvoiceChainState + IdempotentRequest
2. Código: service refactor (issueInvoice/issueCreditNote)
3. Testes 1-25
4. Constraint adicionada
5. Cleanup

---

## 15. Decisão Final

| Pergunta | Resposta |
|---|---|
| **Contraste A0.5 CORRIGIDO?** | Sim |
| **Arquitectura definitivamente fechada?** | Sim |
| **Pronta para implementar em staging?** | Sim, com autorização explícita |
| **Autorização necessária** | Inviar prompt antes execução |
| **Aspectes dependentes de AGT** | AGT — fora do escopo técnico |

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 212, 329-333; crypto.ts; tenant-db.ts:32
- **CONFIRMADO NA BASE DE DADOS:** 0 facturas em staging; zero BusinessDocumentCounter
- **CONFIRMADO POR TESTE:** crypto.test.ts (hash chaining works); graphchain tested already in repo
- **INFERÊNCIA TÉCNICA:** comportamento concorrente sob carga — desenhado mas não executado; testes específicos precisam autorização para realizar
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT

---

**Nenhuma linha de código, schema, migração ou configuração foi alterada. Apenas instrumento de engenharia.**

**Confirmação de entrega:** apenas o documento; zero alterações funcionais.
