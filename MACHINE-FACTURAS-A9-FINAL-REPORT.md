# MACHINE FACTURAS — FASE A9
## Consolidação contabilística, encerramento de exercícios e capacidade operacional

**Branch:** `feat/machine-facturas-a9-accounting-consolidation`
**Origem:** `feat/machine-facturas-a8-fiscal-chain-concurrency` (HEAD `db3c606`)
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a9_test`).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Resultado final

**A9 PARTIALLY COMPLETE.**

Entregas:
1. **Razão** — saldo inicial (antes do intervalo) + movimentos do período + saldo acumulado
2. **Balancete** — saldo inicial, movimento, saldo final, separados por CONTA sintética/analítica, filtros por exercício e período
3. **Statements** (Balanço + DRE) — classificação consistente por `ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE`, inclui painel de contas não classificadas, equação testada
4. **Workflow de exercícios** — pré-validação antes de fecho com 6 regras de verificação (períodos abertos, JE desequilibrados, FT sem JE, divergências reconciliação, contas não classificadas em uso, lançamentos com período órfão), com bloqueio do close se existir bloqueador
5. **Capacidade operacional** — medição: 100 FTs sequenciais em ~6.7s (~67ms/FT); 200 concurrent FTs: 197/200 ok, 3 falham com P2028 (default pool 17)

Lacunas honestas:
- Classificação de contas via campo `GlAccount.kind` (não há classificação customizável multi-camada; o campo é suficiente para statements)
- Exportação de reports (PDF/Excel/CSV) — não entregada nesta fase
- Closed exercises workflow — UI surface é apenas dashboard indicator; o motor de transporte de saldos para novo exercício não está implementado (closeSession only fecha; não transporta)
- 200 concurrent FTs: 197 succeed em 17s, 3 falham com P2028 — documentado; não usamos aumento de pool para passar
- Statements continuam estimativas (não certificação AGT)

---

## 2. Análise do A8 de origem

A8 entregou: causa dos deadlocks 40P01 identificada — advisory-lock redundante removida; 100 FTs concurrent validados; retry on deadlock para FT e NC; full suite 543 testes passing. Permanecem P2028 em 200 concurrent.

---

## 3. Diagnóstico do P2028 (verificação independente)

200 concurrent FTs executados com `PrismaClient` defauls (`maxWait: 2s, timeout: 5s` por default):
- 197/200 sucesso em ~17s
- 3/200 falharam com P2028 ("Unable to start a transaction in the given time")
- Conclusão: capacidade do pool PG default é o limitante; não é uma falha da cadeia
- Limite PG default `max_connections=100`, Prisma default `connection_limit=17`

**Não aumentámos connection_limit** nem transaction timeout para passar mais testes. O problema não se resolve arbitrariamente porque é uma limitação de recurso honesto.

---

## 4. Implementações

### 4.1 Razão — `/contabilidade/razao`

- Filtros: conta, exercício, período
- Saldo inicial: `aggregate(debit/credit)` filtro `postedOnDate < cursor`
- Saldo acumulado linha-a-linha: running balance
- Totais débitos/créditos por intervalo

### 4.2 Balancete — `/contabilidade/balancete`

- Filtros: exercício, período
- Tabela: saldo inicial, débito, crédito, saldo final por conta
- Totais no topo (saldos iniciais agregados, débitos, créditos, diferença)

### 4.3 Statements — `/contabilidade/statements`

- Classificação por `ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE` (sinal por natureza)
- Equação testada: Activo ≈ Passivo + Capital Próprio + Resultado (tolerância 0,10 AOA)
- Painel de unclassified accounts — listadas explicitamente
- Disclaimers claros de não-certificação AGT

### 4.4 Workflow de exercícios — `/contabilidade/exercicios`

- Server-side pre-validation (`gl-exercise-precheck.ts`):
  - Períodos em aberto
  - Lançamentos com diferença débito/crédito > 0,01
  - FTs emitidas sem lançamento contabilístico
  - Divergências abertas na reconciliação
  - Contas sem classificação válida usadas em linhas
  - Lançamentos com periodId apontando para período inexistente
- Bloqueia `closeExercise` se existir BLOCKER
- UI mostra: estado do exercício, número total de lançamentos, contagem de bloqueadores e warnings gerados

### 4.5 Reconciliação mantida estável

Nenhuma alteração ao motor de reconciliação.

---

## 5. Validações

| Validação | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `node tools/scripts/build.mjs` | exit 0 (180+ rotas) |
| `npx prisma migrate deploy` em PG limpo | 61/61 OK (incluindo A6 reconciliation) |
| `npm run lint` / ESLint | só warnings; sem errors |
| Suite completa: `npx vitest run` | **543 passed / 8 skipped** |
| Statements em PG com dados controlados | ✅ equation visible; unclassified panel funciona |
| Multi-tenant isolation (A1/A7 tests) | Saída `ok: 100` em 100 FTs |

---

## 6. Testes de capacidade

| Test | Resultado |
|---|---|
| 100 sequential FTs, tenantId único | ~6.7s (≈67ms/FT) |
| 200 concurrent FTs, default config | 197/200 ok; 3 falhas P2028 |
| 100 concurrent FTs (com row-lock) | 100/100 ok |

---

## 7. Staging/Production/Supabase não tocados

- Apenas PG descartável `a9_test@127.0.0.1:55432` utilizado
- Nenhuma migration fora deste PG
- Nenhuma alteração em `.env`, staging ou produção

---

## 8. Verdict

**A9 PARTIALLY COMPLETE.**

Foram entregues:
- Pre-validation sólida de exercícios
- Statements mais credíveis (mesmo com estimativa clara)
- Razão/Balancete com filtros por período e exercício e saldo inicial herdado

Pendente:
- Exportações (PDF/Excel/CSV) não entregadas
- Abertura de novo exercício com transporte automático de saldos não entregue
- Statements não certificados (critério válido AGT dependente contabilista externo)
- Capacidade de 200 concurrent FTs permanece limitada pelo pool PG (documentado; não mascarado)

**Eu não declaro A9 COMPLETE.**
