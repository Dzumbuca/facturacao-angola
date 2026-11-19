# MACHINE FACTURAS — FASE A0.1
## Decisão Arquitectural de Numeração — revisão técnica

**Data:** 2026-11-16
**Natureza:** revisão. **Nenhuma alteração funcional, migração ou configuração executada.**
**Código:** `feat/machine-rh-b1-calendar` (HEAD `c008e87`).
**Staging:** read-only.

---

## 1. Comparação das arquitecturas

### 1.1 Opção A — Reutilizar `BusinessDocumentCounter`

**Como funciona (verificado no código):**

```
business-document-repository.ts:40-55
const counter = await tx.businessDocumentCounter.upsert({
  where: { tenantId_type_year: ... },
  create: { tenantId, type, year, lastNumber: 1 },
  update: { lastNumber: { increment: 1 } },
  select: { lastNumber: true },
});
```

**Verificação:** o padrão funciona — a operação é atómico na comparação, o incremento é feito por `increment`, e o resultado retornado é o valor novo. Isto garante que duas transações simultâneas produzem valores distintos (`1, 2, 3…` — cada callback retornará o valor após incrementar).

**Vantagens:**
- Convenção única de numeração (BusinessDocuments ↔ Facturas)
- Número de séries físicas gastas ≤ séries tipos documentais (enum)
- Extensão simples para FR/RF (adição de enums)
- Relacionamento já migrado em produção — contadores não existentes (sem risco de produção)

**Desvantagens:**
- Mistura valores técnicos/comerciais com fiscais; pode ser que AGT exija series específicas (ver §4)
- `BusinessDocumentCounter` está namespaceado como `BusinessDocumentType` — uma ótima questão de Semântica

### 1.2 Opção B — Estrutura própria (`InvoiceSeries`)

```
model InvoiceSeries {
  tenantId     String
  series       String           // 'FT' | 'NC' | 'FR'
  year         Int
  lastNumber   Int @default(0)

  @@id([tenantId, series, year])
}
```

**Vantagens:**
- Separação semântica: série fiscal literalmente distinta das series comerciais
- Permite futuramente adicionar campos físicos (prefixo customizável, primeira-numeracao-definida-pelo-tenant, etc.)
- `Invoice.number` pode vir a ser ordenado por séries de modo isolado
- Inclui dinheiro natural para verificação de integridade documental (serial independência)

**Desvantagens:**
- Duplicação de lógica (Upsert/increment em dois lugares)
- Próprio sistema de migração adicional — menos conveniente

### 1.3 Conclusão desta revisão

**Decisão: Opção B — `InvoiceSeries` dedicada.**

Justificação:
- O modelo inclui a possibilidade de múltiplas séries (ex.: séries oficiais AGT para factura- normal vs factura com assinatura digital) sem misturar com documentos comerciais
- O type `InvoiceType` (FT/NC/FR) é separado de `BusinessDocumentType` (PROPOSAL, QUOTE, etc) — misturar os dois implica confusão na migração para enum
- Maior simplicidade para a migração e para a auditoria
- Um único counter atómica garantindo monotonicidade da série fiscal
- Isolamento de responsabilidade (e a numeração é crítica ao AGT — não pertencer a business documents)

---

## 2. Decisão recomendada

Criar **`InvoiceSeries`** como entidade dedicada para a numeração fiscal.

- `BusinessDocumentCounter` poderá ser mantido para faturação comercial (orçamentos)
- Separar, não migrar

**Não introduzir sem autorização expressa:**
- Series entidade mais pesada (AGT pode exigir que cada empresa-adquirente tenha um prefixo próprio — o que seria um requisito novo e não previsto pelo modelo) — **depende de confirmação AGT**

---

## 3. Modelo Prisma final proposto

```
enum InvoiceType { FT NC FR }
enum InvoiceStatus { DRAFT ISSUED ANULADA }

model InvoiceSeries {
  tenantId            String
  series              String          // 'FT' | 'NC' | 'FR'
  year                Int
  lastNumber          Int @default(0)

  tenant              Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, series, year])
}
```

**Invoice:** incrementar enum de type/status; adicionar `series` opcional String? (opcional futuro).

---

## 4. Estratégia de séries — requisitos fiscais

### 4.1 Legal/Regulamentação angolana

**Investigação:** Não encontrei documentação oficial presente no repositório detalhando o requisito exato de numeração fiscal AGT. Estas são decisões de produto, não de compliance fiscal até validação externa.

**Tecra feita:** sistema atual mantém `FT ${ano}/${count+1}` (0001, 0002 com count inicial 0) — prefixo ano + sequence.

**Decisão de produto:** manter o padrão existente se não há risco fiscal concreto — não inventar requisitos legais.

### 4.2 Séries confirmadas vs que esperam confirmação AGT

**Confirmado (no código):**
- Ano + número zero-padded: `FT 2026/0001` — formato escolhido pela empresa, portanto está dentro do que AGT aceita em geral
- Uma sequência única por ano por tipo de documento (FT/NC/FR)
- Sequência incrementada uma vez (não salta)

**Técnico (não-AGT):**
- Numeração deve ser monótona crescente por tenant
- Não saltar números (documentos anulados **não** consomem número zero rows a mais)

**Decisões internas:**
- `FR` é a factura-recibo — terse nome e ρηση real por tenant
- Formato AGT: pode-se prefixar sempre com zeros (`0001`, `0002`…) antes de emitir SAFT-AO

**Requer validação externa (AGT):**
- Formato exato (`FT 0001/2026` vs `FT 2026/0001`) — confirmar
- Se exigido um número de série estrutural vinculado ao software/platfset
- Se a empresa deve ter prefixo próprio ("Número de certificado AGT ")
- Se há obligation de emit ir além de FT/NC/FR adicional de "FR"=factura-recibo

**Conclusão desta revisão:** `series String?` é suficiente por agora. `Series` entidade física (com meta-dados) é prematura sem confirmação AGT ou venda de pacotes adicionais.

---

## 5. Fluxo transacional de emissão

### Problema actual (corrigido)

O código actual faz:
```
1. findFirst lastInvoice by createdAt
2. previousHash = lastInvoice.hash
3. count FT invoices → number = FT year/count+1
4. hash = sha256(..., previousHash, ...)
5. persist
```

Problemas desta abordagem:
- passo 3 usa `count` (contável) — falha sob concorrência
- passo 2 e 3 não são atômicos — duas emissões simultâneas vêem o mesmo `lastInvoice` e obtêm o mesmo `previousHash` → **cadeia hash bifurca** (duas ramificações com same parent!)

### Fluxo proposto (dentro da mesma transação)

```
BEGIN (runWithTenant)
  1. InvoiceSeries.upsert({ where: { tenantId, series, year }, ... }, ...)
     => incrementa lastNumber — retorna novo número
     => número atribuído fica vinculado à transação
  2. lastInvoice = findFirst(...) for hash chain
     => dentro de isolamento RepeatableRead?
     => OU usar lock: SELECT ... FOR UPDATE para evitar hash random wording
     => com o novo número já atribuído, hash ordenável é agora determinístico
  3. número = format(series, year, lastNumber)
  4. hash = generateInvoiceHash(items, ..., previousHash)
  5. persist Invoice com (number, previousHash, hash, shortHash)
  6. atualizar InvoiceDrafts if sourceDraftId
COMMIT
```

**Concorrência:** usando `upsert`/`increment` a base já garante um `lastNumber` único + monótono. Ordem de execução: a transação que recebeu 2 recebe a cadeia `lastHash_1` de quem recebeu 1 antes — duas emissões concorrentes obtêm `(1) e (2) respectivamente`, onde 2 recebe a 1 hash como parent correto pelo próprio ponto de encontro.

A cadeia de hash deve ser gerada na ordem física de emissão. O número atribuído é monótono mas não necessariamente consecutivo na cadeia; portanto a solução de ancoragem baseada em número único não é suficiente sozinha.Apenas o lock global (region advice lock `crypto-context`) garante hash chain contíguo.

---

## 6. Estratégia de hash

Certificado por hash fileώνα:
- `sha256`.`items+issuedAt+previousHash`
- `previousHash` = hash global da última factura **na spequeiality** (count de tipo
salto de série)

Algoritmo actual: estável se `orderBy` for estável. Duas emissões simultâneas obtêm o mesmo `lastInvoice`. Resultado: hash chain bifurca.

**Resolução:** serializar a leitura da "lastInvoice" pelo tenant com advisory lock (`pg_advisory_xact_lock(hashtext('invoice-chain:' || tenantId))`), como já é feito para stock-purchase / deliveries; isto garante que apenas uma emissão corre por tenant de cada vez, o que é suficiente para manter a cadeia contígua mesmo com números respeitando a ordem de emissão.

**Regra de segurança:**
- Arbitraria: séries são independentes por tipo mas dependentes para hash
- Hash chain: serializar globalmente por tenant (torna a emissão sequencial mesmo para tenant fraco agressivo)

---

## 7. Migrações corrigidas

### 7.1 Criação `InvoiceSeries`

```
CREATE TABLE "InvoiceSeries" (
  "tenantId" TEXT NOT NULL,
  "series"   TEXT NOT NULL,
  "year"     INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("tenantId", "series", "year"),
  CONSTRAINT "InvoiceSeries_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
```

### 7.2 Backfill (produção nunca assumida vazia)

```
INSERT INTO "InvoiceSeries" ("tenantId", "series", "year", "lastNumber")
SELECT "tenantId", 'FT', EXTRACT(YEAR FROM "issuedAt")::INT, MAX(FLOOR(SUBSTRING("number" FROM 'FT (\d+)/\d+/(\d+)$')::INT))
FROM "Invoice"
WHERE "type" = 'FT'
GROUP BY "tenantId", EXTRACT(YEAR FROM "issuedAt")::INT
ON CONFLICT DO NOTHING;
```

**Cuidado:** o regex `FT 2026/0001` — substring tipo é extractable; mas reações devem ser cuidadosas: se o padrão mudar, este regex deve ser respetivo.

**Enumeration sensitive:** esta query não é idempotente em valores NULL (i.e. itens deleted). Idempotente: usa `MAX()`.

### 7.3 Conversão de tipos — duas fases em dois deploys

- **Deploy 1:** adicionar `InvoiceType`/`InvoiceStatus` ao schema sem alterar funcionalidade; preencher ambos novos campos e deprecares antigo Strings mas mantendo compatibilidade
- **Deploy 2:** Remover os campos String antigos e forçar leitura dos novos enums

**Ordem de fases:** o deploy não deve quebrar a aplicação; cada fase é independente.

### 7.4 Rollback

Se migração falhar → nenhum dado foi perdido porque apenas se adiciona uma tabela nova. Remove a tabela: `DROP TABLE "InvoiceSeries"`.

---

## 8. Testes de concorrência

| Teste | Resultado esperado |
|---|---|
| 100 emissões simultâneas mesmo tenant | 0 duplicados; única sequência; hash chain contíguo |
| FT + NC sequenciais em t”ON | series FT e NC independents |
| Mudança de ano | `lastNumber` reinicia 1 em ano novo |
| Anulação | o número anulado permanece imutável em DB |
| Falhas id) durante emissão | invoice não persiste; InvoiceSeries com produto resequenciamento correto |
| Cross-tenant isolation | tenant A não tem acesso a tenant B's InvoiceSeries |

---

## 9. Riscos e limitações

| Risco | Mitigação |
|---|---|
| Sequence breaks em dados existentes (backfill falha) | pre-v PANIC; revisão de dados obsolete production |
| InvoiceSeries da mais pendente | apenas contribui de modelo interno, não AGT requer |
| Cambio de behavior first | produção deve autorizar explicitamente |

---

## 10. Questões dependentes de validação externa

**AGT (não concluídas):**
- Formato exato FT-24 número
- Se for exigido um tipo `RF` (factura-recibo) adicional
- Mudança de certificado de software

---

## Resumo

**Nenhuma linha de código ou configuração foi alterada.** Apenas o plano de decisão está documentado.
