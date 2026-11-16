# MACHINE FACTURAS — FASE A0.3
## Especificação técnica definitiva — numeração e cadeia de hash

**Data:** 2026-11-16
**Natureza:** especificação. **NENHUMA** alteração funcional, migração ou configuração foi executada nesta fase.
**Staging:** read-only. **Produção não tocada.**
**Código:** `feat/machine-rh-b1-calendar` (HEAD `c008e87`).

---

## 1. Sumário executivo

São adoptadas as decisões arquitecturais das fases A0.1 e A0.2, **com um reforço crítico**: a utilização de `ORDER BY createdAt` como critério de ordenação da cadeia de hash é insuficiente. Não há garantia de que o timestamp esteja estabilizado no momento exacto da emissão. A cadeia de hash, para ser auditável, precisa de ancoragem em **estado explícito** (`InvoiceChainState`) em vez de no registo cronológico.

**Decisão final:** introduzir `InvoiceChainState` com 4 colunas (`tenantId`, `lastSequence`, `lastHash`, `lastInvoiceId`) como entidade fiscal de primeira categoria. Implicado `advisory lock` (`pg_advisory_xact_lock(hashtextextended(...))`) como mecanismo de serialização por tenant.

**Maturidade:** esta especificação dá todos os artefactos para iniciar a implementação da Fase A. **Recomendação: APROVADO COM CONDIÇÕES.** As condições permanecem as mesmas das fases anteriores:

1. AGT: certificado pendente;
2. Produção não assumida vazia; inventário obrigatório antes do backfill.

---

## 2. Evidências do código actual

| Local | Evidência |
|---|---|
| `prisma/schema.prisma` | `Invoice` sem `@@unique([tenantId, type, number])`; `Invoice.type/status` String livres |
| `src/lib/invoice-service.ts:93-97` | `count + 1` para FT; `count + 1` para NC (329-333) |
| `src/lib/invoice-service.ts:84-98` | `orderBy: { createdAt: 'desc' }` sem lock → hash chain bifurca |
| `src/lib/invoice-service.ts:212` | `FOR UPDATE` **depois** do count → protege quota, não número |
| `src/lib/crypto.ts:24-44` | `generateInvoiceHash` faz canonicalização ordenada dos campos e usa `previousHash` |
| `src/lib/tenant-db.ts` | `runWithTenant` não força nível de isolamento |
| `src/lib/business-document-repository.ts:40-55` | Counter atómica existe e funciona; **não usado** para facturação fiscal |
| `src/lib/saft-ao.ts:51` | `SoftwareCertificateNumber: '000/AGT/2026'` — placeholder |
| `src/lib/invoice-service.ts:212` | Integração cliente-emp/empresa existe — emissão serializada se obtê-lo com lock tenant row |

**Decisão:** sem a correcção de contagem e hash chain, o sistema, mesmo com serialização de quota, está exposto a duplicações fiscais; nenhum processo fiscal atesta isso.

---

## 3. Decisão sobre InvoiceChainState

### 3.1 Problema A — problemas com `ORDER BY createdAt DESC`

`createdAt` é `timestamptz` do default do Postgres (now()). **Dois insert simultâneos no mesmo segundo podem ter o mesmo timestamp ou ordering arbitrário no mesmo ms.** É possível, portanto, que duas transações simultâneas dêiem a mesma resposta, e dois subdocumentos terem como hash parentes diferentes ou o mesmo.

### 3.2 Análise Opção A vs B

| Opção | Integridade | Complexidade | Rebuild =? | Recuperação |
|---|---|---|---|---|
| **A. Última factura em consulta com critério determinístico** | MÉDIA–alta | Baixa | Sim (reconstruível) | Manual (repair) |
| **B. Artefacto de estado `InvoiceChainState`** | ALTA | Média | Não (estado de referência) | Automática (consulta espelhada) |

**Decisão:** adoptar **Opção B** — `InvoiceChainState` como entidade de primeira categoria fiscal. Toda emissão deverá: (a) lock, (b) increment InvoiceSeries, (c) update InvoiceChainState com o novo hash + ID, (d) commit.

**Backbone de reconstrução:** se `InvoiceChainState` ficar inconsistente, pode ser reconstruído re-iterando as facturas ordenadas por (year, sequence) e reconciliando o último hash conhecido.

---

## 4. Arquitectura do advisory lock

### 4.1 Assinatura PostgreSQL

`pg_advisory_xact_lock(key bigint)` e `pg_advisory_xact_lock(key1 int, key2 int)`.

**Precisão técnica sobre `hashtext` e `hashtextextended`:** `hashtext(string)` retorna `integer` (32 bits). Para 64 bits, `hashtextextended(text, seed bigint)` — presente no PostgreSQL atual.

**Escolha do hash:** `hashtextextended('invoice-chain:'||tenantId, 0)::bigint` — 64 bits.

**Risco de colisão:** não há proteção mínima garantida — a colisão em 64 bits para dois tenants é ≤ 2⁻⁶⁴. Aceito como security macro-space.

**Lock não colisão primário:** identificado por tenantId; em produção até 10K tenants, sem problema.

### 4.2 Exemplo completo (**não executar**)

```sql
SELECT pg_advisory_xact_lock(hashtextextended('invoice-chain:' || $1, 0));

-- Próxima geração: portable para Prisma através de $queryRaw, já em uso no código
```

### 4.3 Comportamento

- Escopo de transacção: liberado automaticamente ao commit/rollback
- Não bloqueia linhas, não colide com locks normais
- Comportamento com N múltiplas instâncias: PostgreSQL serializa automaticamente entre elas (mesmo mediador físico PostgreSQL, mesmo advisory lock table)
- Timeout/rollback: seguro — lock é liberado
- Deadlock entre chamadas: pequeno (passcodewise), mas com mesmo ambiente ativo — ordem não pode partir dum que apenas aquilo funciona bem

---

## 5. Estratégia de numeração — sem fallback

**Nenhuma emissão de factura pode recorrer a `count + 1`.** O fluxo abaixo é mandatório:

| Etapa | Acção quando falha |
|---|---|
| Upsert de InvoiceSeries | Rollback; emissão não acontece |
| Aquisição do lock | Transacção aguarda / timeout → ROLLBACK |
| Conflicto de unicidade | Aplicação recebe erro → ROLLBACK — nunca continua |
| BD indisponível | Aplicação devolve erro claro ao UI |

**Idempotência:** o cliente repete a operação; a mesma `sourceDraftId` (ou `clientToken`) é reexclusa de forma atómica no `InvoiceSequence.issue`. Emisições reactivas após timeout obtêm a mesma factura já emitida, não uma nova.

---

## 6. Idempotência

Padrão: **Chave externa idempotente** para toda emissão — aplicar o mesmo para NC.

- `POST /api/invoices/issue` aceita um `idempotencyKey` (UUID por emissão explícita)
- Se a emissão já aconteceu (mesg & chain), a resposta é **a mesma** de antes
- O sistema nunca cria duas facturas para o mesmo documento rascunho/ato

---

## 7. Backfill e reconciliação

### Etapa 1 — Diagnóstico (não executado)

```sql
-- Formatos não-padrão (erro)
SELECT DISTINCT number FROM "Invoice"
WHERE number !~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$';
```

### Etapa 2 — Reconciliação

```sql
-- Maior sequência por tenant/tipo/ano válido
SELECT tenantId, split_part(number, ' ', 1) AS series,
       substring(number from '([0-9]{4})')::int AS year,
       max((substring(number from '/([0-9]+)$'))::int) AS max_seq
FROM "Invoice"
WHERE number ~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$'
GROUP BY tenantId, split_part(number, ' ', 1), substring(number from ' ([0-9]{4})')::int;
```

### Etapa 3 — Backfill idempotente

```sql
INSERT INTO "InvoiceSeries" (tenantId, series, year, lastNumber)
SELECT tenantId, split_part(number, ' ', 1) AS series,
       substring(number from '([0-9]{4})')::int AS year,
       MAX(substring(number from '/([0-9]+)$'))::int AS last_seq
FROM "Invoice"
WHERE number ~ '^[A-Z]{2,3} [0-9]{4}/[0-9]+$'
GROUP BY tenantId, split_part(number, ' ', 1), substring(number from ' ([0-9]{4})')::int
ON CONFLICT (tenantId, series, year) DO UPDATE SET
  lastNumber = GREATEST("InvoiceSeries".lastNumber, EXCLUDED.lastNumber);
```

**Não executar.** Staging está vazio (0 facturas). Produção não assumida vazia.

---

## 8. Modelo Prisma definitivo

```
model InvoiceSeries {
  tenantId      String
  series        String           // 'FT' | 'NC' | 'FR'
  year          Int
  lastNumber    Int  @default(0)

  tenant        Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, series, year])
}

model InvoiceChainState {
  tenantId      String   @id
  lastInvoiceId String?
  lastHash      String?
  lastSequence  Int?
  updatedAt     DateTime @updatedAt

  tenant        Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

enum InvoiceType   { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model Invoice {
  ...
  type       InvoiceType
  status     InvoiceStatus
  number     String
  chainHash  String?

  @@unique([tenantId, type, number])
}
```

---

## 9. Fluxo transaccional definitivo

```
BEGIN (runWithTenant)
  1. Adquirir advisory lock: `pg_advisory_xact_lock(hashtextextended('invoice-chain:' || tenantId, 0))`
  2. Garantir existência de `InvoiceSeries` (INSERT ... ON CONFLICT DO NOTHING)
  3. Upsert: incrementa lastNumber (`lastNumber += 1`) e retorna o valor atribuído
  4. SELECT ... FROM "InvoiceChainState" FOR UPDATE
  5. previousHash = state.lastHash (ou NULL se primeiro)
  6. hash = sha256(items + issuedAt + previousHash)
  7. Persistir InvoiceChainState com novo lastHash
  8. Persistir Invoice (type=FT|NC|FR, number=o atribuído)
  9. Atualizar draft origin (se aplicável)
COMMIT
```

**Rollback:** toda a secção acima reverte sem resíduo.

---

## 10. Política da cadeia de hash

- A cadeia é **global ao tenant** — FT e NC partilham a mesma sequência de hash
Apenas facturas efetivamente emitidas participam da cadeia. Nenhum DRAFT entra na cadeia.
- Antes de persistir `Invoice`, comparar sequências — a emissão tem de ser linear
- Cadeia reconstruível a partir de:
  `lastInvoice.hash := sha256( sequência anterior + conteúdo )`
- Qualquer inconsistência — `NULL` em `lastSequence` ao existir factura — invalidar emissão e requerer revisão

---

## 11. Tratamento de falhas

| Ponto de falha | Comportamento | Resultado |
|---|---|---|
| BD não responde | Transacção abortada | Nenhuma factura persistida; client informa erro |
| Unique violation | Rollback | Cliente recebe 409 |
| Disparo de deadlock | Transacção morta (server) | Cliente recebe 503; imediata retry seguro é possível |
| Hash mismatch | Inconsistência | Requer manual review antes de publicar |
| Reporte de número excecional | Inconsistência total | Bloqueio para o tenant até resolver |

---

## 12. Matriz de testes

| # | Cenário | Preparação | Esperado | Critério |
|---|---|---|---|---|
| 1 | 100 emissões simultâneas no mesmo tenant | load test | 0 duplicados; cadeia linear | número sequencial `FT 2026/0001` a `FT 2026/0100` sem saltos |
| 2 | 500 emissões simultâneas | load test em staging | 0 violações UNIQUE | sequência contígua |
| 3 | 2 instâncias distintas | controllers separados | sem bifurcação da cadeia | único root hash |
| 4 | FT e NC concorrentes | 2 transacções paralelas | séries independentes (FT e NC) | sem colisão |
| 5 | Rollback a meio da emissão | Injetar exceção | Zero órfão | nenhum registo persistido |
| 6 | repetição de requisição | 1 screen 2 cliques | sem emissão duplicada | 1 factura criada |
| 7 | Timeout do cliente | corte de conexão | sem emissão duplicada | exactamente 1 factura criada |
| 8 | Anulação posterior | ciclo de emissão completo + anulação | número preservado para sempre | valor imutável |
| 9 | Falha após geração do hash | trip point forçado | zero órfão | rollback automático |
| 10 | Recuperação de estado inconsistente | desincronização forçada | processo restaurado | revisão manual e reconciliação |

---

## 13. Migração expand-contract resumida

| Fase | Acção | reversível |
|---|---|---|
| Expansão | Cria InvoiceSeries, InvoiceChainState, enums novos | Sim |
| Dual-code | Código novo usa caminhos InvoiceSeries; antigo count fallback com warning | Sim |
| Contração | Remove caminhos antigos; converte para enums | Não |

---

## 14. Riscos residuais

- `SoftwareCertificateNumber: '000/AGT/2026'` — significa que **ficheiro SAFT não é produção-legítimo** até certificado real
- Staging zero facturas — production não assumida vazia (requer inventário antes de backfill)

---

## 15. Plano de implementação

### Fase A — Integridade fiscal (≈ 2-3 semanas)

1. PA1 — Migration (NOT EXEC, stored plan): InvoiceSeries, InvoiceChainState, enums
2. PA2 — Código dual (fase-expansão)
3. PA3 — Testes de concorrência com carga real
4. PA4 — Constraint UNIQUE
5. PA5 — Cleanup

### Fase F — AGT (sem prazo)

0. Depende da formalização da empresa + certificado de software AGT

---

## 16. Decisão final

### Maturidade para iniciar implementação

**A arquitectura está pronta** tecnicamente para a implementação, **do ponto de vista do design**. Permanece pendente:

- **AGT** — processo de certificação de software não pode ser substituído
- **Inventário de produção** antes de qualquer migração (`SELECT DISTINCT type, status FROM "Invoice"` se o cliente quiser algo concreto)
- **Autorização formal para aplicar as migrações em staging**

**A implementação da Fase A só pode começar mediante autorização expressa.**

**Nenhuma linha de código, schema ou migração foi executada.**
