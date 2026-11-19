# MACHINE FACTURAS — FASE A0.5
## Fecho Arquitectural — Integridade documental

**Data:** 2026-11-16
**Natureza:** fecho arquitectural e reforço de pontos de A0.4. **Nenhuma alteração funcional.**
**Staging:** read-only. **Produção não tocada.**
**Código:** `feat/machine-rh-b1-calendar`.

---

## 1. Sumário executivo

A0.5 finaliza as inconsistências documentadas em A0.4 e produz a última especificação técnica da Fase A antes da implementação. Três pontos cruciais de A0.4 foram corrigidos ou esclarecidos:

1. **Separação explícita entre 'type' e 'series'** — 'seriesCode' fica reservada para a série fiscal; 'documentType' fica com FT/NC/FR
2. **Imutabilidade documental** — regra RESTRICT em relações históricas e correcção por NC/devolução em vez de editar documentos emitidos
3. **Política transaccional disciplinada de locks** — ordem fixa: advisory → InvoiceSeries → InvoiceChainState → Invoice

**Decisão final: APROVADO COM CONDIÇÕES — está pronta para iniciar a implementação em staging após autorização explícita.**

---

## 2. Pendências da Fase A0.4 — correcção integral

| Pendência na A0.4 | Correcção na A0.5 |
|---|---|
| Identificação da raiz via `createdAt` com `ORDER BY` | Rígidamente definida por `previousHash IS NULL` + `chainSequence == 1` (atômico) |
| `series = 'FT' | 'NC' | 'FR'` conflito de semântica | Separado: `seriesCode` (A, B) e `documentType` (FT, NC, FR) |
| OnDelete: Cascade em Invoice/ tenant | Proibido histórico — imutável |
| `2000-05-01` had hash fallback errors reescritos | Removido qualquer fallback; fluxo única sequence |
| `IdempotencyKey` client-side validation only | tabela `IdempotentRequest` com hash do payload |
| Hash canônico não versionado | `hashVersion` adicionado |

---

## 3. Arquitectura Final — Idempotência

```
model IdempotentRequest {
  tenantId      String
  key           String           // UUID gerado pelo client
  resource      String           // 'INVOICE' | 'CREDIT_NOTE'
  resultId      String?          // ID da factura criada
  payloadHash   String           // canonical hash of payload fields
  createdAt     DateTime @default(now())

  @@id([tenantId, key])
  @@index([tenantId, createdAt])
}
```

**Canonicalização**: object ordenado por chave + JSON Web Canonicalization Scheme (JCS) / canonicalised JSON. **Hash SHA-256.**

**Não validar localmente**; validação só no servidor, dentro do lock.

---

## 4. Algoritmo de reconstrução histórica

```
Localizar raíz:
  WHERE previousHash IS NULL AND chainSequence = 1

Validar a raiz única por (tenantId)

Validar as ligações:
  para cada factura F[i] onde i > 1, F[i].previousHash == F[i-1].hash

Validar hashes:
  recalcular sha256(payload) e comparar

Detectar:
  - Bifurcações: duas facturas com o mesmo previousHash
  - Órfãos: previousHash que não corresponde a nenhuma factura existente
  - Saltos: chainSequence não consecutivo para sealed chain
  - Conteúdo adulterado: hash não bate
```

### Recuperação

| Caso                           | Acção
|---|---
| Reconstrução verificável       | Reconstrói InvoiceChainState
| Estado desincronizado          | Reconstrói a partir de hash colectivo
| Documento adulterado           | Bloquear tenant + alerta
| Documento removido            | Bloquear tenant + alerta
| Múltiplas raízes               | Bloqueio total
| Histórico impossível de reconstituir | Bloqueio total; bloqueio em produção |

**Nunca sobrescrever silenciosamente hashes históricos.**

---

## 5. Separação entre tipo e série

```
model InvoiceSeries {
  tenantId    String
  seriesCode  String           // 'A', 'B' — code returned by AGT/surrogate
  documentType InvoiceType     // 'FT', 'NC', 'FR'
  year        Int
  lastNumber  Int @default(0)

  @@id([tenantId, seriesCode, documentType, year])
}
```

Justificação técnica: o alcance jurídico da série fiscal é distinto do tipo documental; incluir `documentType` na chave composta elimina a ambiguidade de uma mesma série partilhar FT/NC/FR numeração, embora ambos reinadem separadamente.

---

## 6. Política de imutabilidade

- **Invoice** — `delete = RESTRICT` (não permitido)
- **InvoiceItem** — espelha `Invoice`
- **Payment** — `delete = RESTRICT`
- **PaymentReceipt** — `delete = RESTRICT`
- **InvoiceSeries / InvoiceChainState** — `delete = RESTRICT`
- **IdempotentRequest** — `delete = RESTRICT` (auditoria)
- **Tenant** — soft-deactivate `status='DEACTIVATED'`, nunca delete físico com histórico

**Regra de correcção documental:** erros corrigidos por nova factura (NC/devolução), nunca alterando documento emitido.

---

## 7. Hash canónico e versionamento

```
function canonicalize(invoice): string {
  // ordem explícita; valores primitivos; sem tocar no schema
  return JSON.stringify({
    customerName: invoice.customerName,
    customerNif: invoice.customerNif,
    items: invoice.items.map(serializeItem).sort(bySku),
    applyVat: invoice.applyVat,
    discountAmount: invoice.discountAmount,
    discountType: invoice.discountType,
    discountValue: invoice.discountValue,
    observations: invoice.observations ?? null,
    includeCompanyProfile: invoice.includeCompanyProfile,
    companyLogoId: invoice.companyLogoId ?? null,
    subTotal: invoice.subTotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    date: invoice.issuedAt,
    previousHash: invoice.previousHash,
  });
}
```

**`hashVersion Int @default(1)`** — increments in schema updates; migração apenas com decisão expressa.

**Algoritmo:** SHA-256; encoding UTF-8; full canonicalização JCS ou equivalente verificável.

**Integridade ≠ assinatura:** hash protege integridade; certificado AGT protege legitimidade fiscal; são camadas diferentes e independentes.

---

## 8. Estratégia de migração

### Passo 1 — Diagnóstico
- Detectar formats desconhecidos
- Detectar duplicados e bifurcações
- Contar documentos históricos; nem assumida produção vazia

### Passo 2 — Reconstrução verificável
- Se histórico incompleto / hash inconsistente: bloqueio + backup + manual

### Passo 3 — Backfill
- Inserir `chainSequence` a partir do `hash`

### Passo 4 — Novos campos
- `InvoiceChainState.lastSequence` = função de `max(chainSequence)`

### Passo 5 — Constraints
- `@@unique([tenantId, type, number])`
- `@@unique([tenantId, chainSequence])`

### Passo 6 — Activação
- Branch protection requires staging verde ≥ 5 dias antes de produção

**Proibição de fallback** — nada de caminhos alternativos `count()`.

---

## 9. Modelo Prisma definitivo (consolidado)

```prisma
enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }
enum PayloadTableDatesType { YYYY_MM_DD, ISO_8601 }

model InvoiceSeries { tenantId String; seriesCode String; documentType InvoiceType; year Int; lastNumber Int @default(0); @@id([tenantId, seriesCode, documentType, year]); @@index([tenantId]) }

model InvoiceChainState { tenantId String @id; lastHash String?; lastSequence Int @default(0); lastInvoiceId String?; updatedAt DateTime @updatedAt }

model IdempotentRequest { tenantId String; key String; resource String; resultId String?; payloadHash String; createdAt DateTime @default(now()); @@id([tenantId, key]); @@index([tenantId, resource, createdAt]) }

model Invoice {
  id String @id @default(uuid())
  tenantId String
  number String
  type InvoiceType
  status InvoiceStatus
  chainSequence Int?
  hashVersion Int @default(1)
  hash String
  previousHash String?
  // …vídeos anteriores

  @@unique([tenantId, type, number])
  @@unique([tenantId, chainSequence])
  @@index([tenantId, issuedAt])
}
```

**Notas:** `hash` mantém-se UNIQUE global — comportamento correcto para chainTos únicos por documento.

---

## 10. Fluxo transaccional definitivo

```
1. Auth/validate tenant
2. Validate idempotencyKey:
     SELECT * FROM IdempotentRequest WHERE key=$1
     se payloadHash coincide → retorna resultId (NO EMISSION)
     senão → 409 conflict
3. BEGIN transaction
4. pg_advisory_xact_lock(hashtextextended(...)) — advisory lock
5. INSERT ... ON CONFLICT DO NOTHING para InvoiceChainState
6. SELECT FOR UPDATE InvoiceChainState
7. InvoiceSeries upsert: IncrementlastNumber
8. chainSequence = chainState.lastSequence + 1
9. previousHash = chainState.lastHash
10. hash = sha256(canonicalize(...))
11. INSERT Invoice (status='ISSUED' chainSequence hash)
12. UPDATE InvoiceChainState (lastSequence=chainSequence, lastHash=hash, lastInvoiceId=Invoice.id)
13. INSERT IdempotentRequest (resultId=Invoice.id)
14. SourceDraftId → ISSUED (se houver)
COMMIT
```

**Falha em qualquer etapa** → rollback total; nada é emitido; estado devolvido seguro.

---

## 11. Política de locks — ordem fixa

1. advisory lock por tenant
2. InvoiceSeries
3. InvoiceChainState
4. Invoice

**Nunca inverter ordem** — garante ausência de deadlock entre instâncias.

---

## 12. Matriz de testes (atualizada)

| # | Cenário | Esperado | Critério |
|---|---|---
| 1 | 100 emissões simultâneas | 0 duplicados; cadeia linear | sequence 1-100 sem saltos |
| 2 | 500 emissões simultâneas | sem falhas | sequência contígua |
| 3 | FT+NC concorrentes | cadeias separadas por tipo | autónomo |
| 4 | 2 instâncias app | cadeia contígua | cadeia uniformed |
| 5 | Tenant paralelo | isolado | zero cross effects |
| 6 | Mesma key | 1 factura criada | exactamente 1 |
| 7 | Mesma key payload diferente | 409 | reject |
| 8 | Timeout pós COMMIT | 1 factura | mesmo resultado | 1 única factura |
| 9 | Falha antes do COMMIT | ROLLBACK | nada persistido | 0 rows |
| 10 | Falha após reservar número | ROLLBACK | 0 órfãos | 0 órfãos |
| 11 | Falha após gerar hash | ROLLBACK | zero orphan | zero orphan |
| 12 | Falha chainState | ROLLBACK | zero orphan | nenhum |
| 13 | Inicialização simultânea | 1 row | exactamente 1 | 1 |
| 14 | Duplicate sequence | REJECT | 409 | rejeita |
| 15 | Documento removido | detectar | reject | bloqueado |
| 16 | Hash tampered | detectar | bloqueio | inacessível |
| 17 | Bifurcação | alert | bloqueio fiscal | tenant frio |
| 18 | Reconstrução integral | rebuild successful | linear | OK |
| 19 | Anulação posterior | preservado | imutável after | número persistente |
| 20 | Alteração documento emitido | REJECT | bloquear | 409 |
| 21 | Tentativa apagar tenant com histórica | REJECT | nada apagado | restrict |

---

## 13. Riscos residuais

- AGT — processo separado, não resolvido por este documento
- Produção com dados reais deve ser inventariada antes da migração
- Nenhum tratamento cacheado (middleware outbox) neste proto

---

## 14. Plano de implementação (resumido)

### Fase A — Integridade fiscal (≈ 2-3 semanas)

1. Schema extension — criar modelos novos + enums em staging
2. Código dual — novo fluxo activo; antigo com logging; desativado para novos
3. Tests 1-21 conforme matriz
4. Constraint UNIQUE
5. Cleanup
6. Pilotar com 1-2 clientes reais antes de produção total

**Fase F — AGT (external, no prazo)**

---

## 15. Critérios de aprovação

| Critério | Status |
|---|---|
| Idempotência resistente a dupla submissão | ✅ incluído |
| Cadeia com raiz e sequência global | ✅ incluído |
| Reconstrução independente de timestamp | ✅ incluído |
| Tipo separado de série fiscal | ✅ incluído |
| Histórico imutável | ✅ incluído |
| OnDelete restritivo | ✅ incluído |
| Hash canónico versionado | ✅ incluído |
| Não existência de fallback `count+1` | ✅ incluído |
| Migração segura para dados históricos | ✅ incluído |
| Persistância idempotente em BD | ✅ incluído |

---

## 16. Decisão Final

| Pergunta | Resposta |
|---|---|
| **A arquitectura está definitivamente fechada?** | Sim — inerente pendências corrigiram |
| **Pronta para implementar em staging?** | Sim, com autorização explícita |
| **O que impede ainda a implementação?** | (a) autorização explícita do cliente, (b) inventário de produção, (c) janela de testes de concorrência sob carga |
| **Aspectes dependentes de validação AGT?** | AGT não depende deste documento; AGT pendente de formalização da empresa |

**Nenhuma linha de código, schema ou migração foi executada nem nesta fase nem nas anteriores. Staging e produção preservadas.**

---

## Honestidade técnica

- **CONFIRMADO NO CÓDIGO:** invoice-service.ts:93-97, 329-333, 212; crypto.ts; payment-service.ts; stock-service.ts:121
- **CONFIRMADO NA BD:** 0 facturas em staging; zero BusinessDocumentCounter; todos relacionamentos Invoice→Cascade no schema (incorrecto para audit history)
- **CONFIRMADO POR TESTE:** crypto.test.ts (hash chaining); ad-unlock-core.test.ts
- **INFERÊNCIA TÉCNICA:** comportamento concorrente — não executado
- **PENDENTE DE VALIDAÇÃO EXTERNA:** AGT certificado de software e alocução SAFT-AO
