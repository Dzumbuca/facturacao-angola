# MACHINE FACTURAS — FASE A7
## Consolidação dos saldos, exercícios contabilísticos e integridade multi-tenant

**Branch:** `feat/machine-facturas-a7-accounting-integrity`
**Origem:** `feat/machine-facturas-a6-reconciliation` (HEAD `70e8c54`)
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a7_test`).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Resultado final

**A7 PARTIALLY COMPLETE.**

Entregas principais:
1. Razão por conta com filtros funcionais por **exercício, período e saldo inicial** — totalmente reescrito
2. Balancete com filtros equivalentes, separa abertura/débito/crédito/fecho
3. FT issuance com retry on deadlock / timeout (issueInvoiceOnce)
4. Reconciliação multi-tenant: execução em paralelo com isolamento comprovado
5. Sidebar Contabilidade expandida para 9 items

Lacunas honestas:
- Stress test de 200 operações simultâneas: **não é viável com a arquitetura atual** (advisory lock do chain fiscal serializa FTs ~4 concurrent por tenant; além disso ocorre 40P01 deadlock)
- Razão com saldo de abertura real: implementado apenas para linhas com cursor antes do período; a query usa `aggregate` mas depende dos dados existentes no DB actual
- Encerramento/Abertura de exercícios via UI: existe serviço (`gl-period-actions.ts`), mas a UI de encerramento completo e ferro não está finalizada/cosmética
- Balanço e DRE permanecem estimativas sem classificação especializada por conta
- Razão não deriva saldos de exercícios anteriores (cumula a partir do início da DB)
- AGT compliance: não declarada; requer validação externa com contabilista certificado

---

## 2. Permanece igual a antes (preservação integral de A1–A6)

Todos os commits A1–A6 estão preservados no histórico:

```
dcdf180 feat(A7): resilient FT issue (retry on deadlock/timeout) + multi-tenant reconciliation stress test
3a91b29 feat(A7): period/exercise filters on Razão and Balancete
... (todos os commits A1 a A6 permanecem presentes e inalterados)
```

**84+ commits à frente de `main`**; branches `feat/machine-facturas-a1-integrity`, `a2-erp-consolidation`, `a3-functional-integration`, `a4-accounting`, `a5-accounting-completion`, `a6-reconciliation` — todas intactas.

---

## 3. Implementação

### 3.1 Razão — `/contabilidade/razao`

- Filtros: conta, exercício, período
- Saldo inicial: query `aggregate(debit/credit)` de linhas com `postedOnDate < startCursor`
- Saldo acumulado por linha
- Total débitos/créditos do período
- Saldo final
- Renderizáveis: até 50 linhas com tipo/number/data, origem (`source` + sourceId prefix)
- Suporta exercício/período vazios ("todos os exercícios" / "todos os períodos")

### 3.2 Balancete — `/contabilidade/balancete`

- Filtros: exercício, período
- 3 colunas por conta: Saldo inicial | Débito | Crédito | Saldo final
- Totals agregados por tenant
- Diferença débito vs crédito visível (equação já verificável)

### 3.3 FT issuance com retry — `issueInvoice`

Wrapper `issueInvoiceOnce` chama a função original com retry:
- P2010 com 40P01 / 40001 → retry (deadlock / serialization_failure)
- P2024 (connection pool timeout) → retry
- P2025 → retry
- 5 attempts com jitter backoff 50–250ms

`isApplicationEnabled(tenantId, slug, tx?)` — aceita transaction opcional para evitar connection pool leaks durante FT issuance.

### 3.4 Stress test multi-tenant — `a7-multi-tenant-reconciliation.integration.test.ts`

Cenário: 2 tenants, 20 FTs sequenciais por tenant (executados em paralelo entre tenants).
- ✅ Tudo passa
- ✅ Reconciliação em paralelo para ambos tenants com isolamento total
- ✅ Nenhuma divergência entre JEs e FTs

Stress verdadeiro (50 FT/tenant) foi investigado e causou **deadlock 40P01** no código de chain fiscal; após investigação concluiu-se:
- Advisory lock serializa FTs do mesmo tenant
- Concorrência > ~4 FT.por/tenant triggerar deadlock
- Para 200 simultaneous operations, a arquitectura actual não é viável

**Conclusão honesta:** a arquitectura de chain fiscal precisa de refactor para suportar cenários altamente concorrentes. Isto não foi implementado nesta fase.

### 3.5 Verificação do build

| Validação | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `node tools/scripts/build.mjs` | exit 0 (180+ rotas) |
| `npx prisma migrate deploy` em base a7_test limpa | 61 migrations OK |
| `npx vitest run` (full, com disposable PG) | 538 passing (após reseed RH tenants) |
| Suite integração A1/A2/A3/A4/A6 | ✅ |

---

## 4. Limitações (honestas)

| Lacuna | Porque |
|---|---|
| Stress test 200 operações simultâneas | Não viável sem refacção do chain fiscal; deadlock inevitável com architecture A1 actual |
| Razão com saldo de abertura por período (não desde o início) | Requerance de saldo anterior precisa de query mais complexa ou materialized view; actualmente agrega monotonamente desde o início da DB |
| Balancete com filtro por período real | Só filtra linhas; SBrowser remain forever |
| Exercício close/open via interface completa | Serviço existe; UI presentational, mas falta workflow validação estado periodos antes do fecho (verificação já parcial no `closeExercise`) |
| Consistência 100% entre Diário, Razão, Balancete, Balanço, DRE | Statements são estimativas; não há classificador de contas por categoria fiscal |
| Monthly fiscal closing statements | Não implementados |
| AGT | Não declarada; requer contabilista certificado externo em Angola |
| Multi-tenant stress com 50+ FT por tenant em paralelo | Arquitectura A1 actual não suporta |

---

## 5. Staging/Production/Supabase não tocados

- Nenhum de `.env*`, Supabase, produção tocado
- Apenas PG descartável `a7_test` utilizado

---

## 6. Verdict

**A7 PARTIALLY COMPLETE.**

Razão/Balancete com filtros de exercício/período funcionais; isolamento multi-tenant comprovado a nível estrutural; retry on deadlock. Docs e relatório representam um ERP com contabilidade planeável, mas com lacunas significativas em:

- Stress real de concorrência
- Encerramento de exercício com workflow completo
- Statements oficiais (Balanço / DRE) certificados

**Eu não declaro A7 completo. Não há conformidade AGT declarável.**
