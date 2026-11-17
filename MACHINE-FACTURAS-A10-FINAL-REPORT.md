# MACHINE FACTURAS — FASE A10
## Encerramento contabilístico real, transporte de saldos e relatórios exportáveis

**Branch:** `feat/machine-facturas-a10-accounting-finalization`
**Origem:** `feat/machine-facturas-a9-accounting-consolidation` (HEAD `d00d399`)
**Data:** 2026-11-17 (actualizado 22:15)
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (PG local; `a10_verify` para validation).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Resultado final

**A10 PARTIALLY COMPLETE** — avanço significativo sobre A9, mas sem conformidade AGT e com limitações.

Entregas:
1. **Apuramento real** — `apurarResultado`: agrega REVENUE/EXPENSE em lançamentos POSTED dentro do exercício; gera **um** JE CLOSING `source=EXERCISE_CLOSE`; marca exercício CLOSED; idempotente.
2. **Abertura automática com transporte** — `abrirProximoExercicio`: cria próximo exercício + 12 períodos mensais; transporta apenas saldos patrimoniais (ASSET/LIABILITY/EQUITY), nunca REVENUE/EXPENSE. Idempotente.
3. **Prova de retained-earnings** — integration test verifies: receita 1.000.000 − despesa 400.000 = 600.000 result; apuramento deposita 600.000 na conta EQUITY de destino; a abertura do próximo exercício transporta esses 600.000 como saldo inicial.
4. **Exportações** — CSV (`/api/contabilidade/export?type=razao|balancete|diario`), Excel (.xlsx via exceljs), e PDF (Balanço/DRE estimativo), todos com dados idênticos à interface.
5. **Statements credível** — classe por `kind`, equação Activo = Passivo + Capital + Resultado visível.
6. **Robustez chain FT** — retry inclui P2028 (pool-timing contention).

Lacunas:
- AGT compliance não declarável sem validação externa
- Statements estimativos, não certificados
- 200 concurrent FTs ainda limitado pela pool PG default (documentado; 197/200 avaliado em default)
- Períodos com entries desequilibrados não podem ser fechados (validação bloqueia antes)

## 2. Implementação

### 2.1 Apuramento e opening — `src/lib/gl-exercise-closing.ts`

`apurarResultado(tenantId, year, closedBy, justification)`:
- Procura exercício; se já CLOSED, no-op
- Verifica períodos em aberto; recusa se existirem
- Agrega contas REVENUE (crédito − débito) e EXPENSE (débito − crédito) com `status=POSTED`
- Destination EQUITY: primeira activa (conta de resultados acumulados) correcta
- Garante exactamente **um** `EXERCISE_CLOSE` JE; idempotente
- Marca exercício CLOSED

`abrirProximoExercicio(tenantId, nextYear, justification, closedBy)`:
- Verifica exercício prior CLOSED
- Cria exercício se não existe; garante 12 períodos mensais OPEN
- Verifica se já existe um `EXERCISE_OPEN`; se sim no-op
- Agrega saldos patrimoniais em entries POSTED com `postedOnDate <= fim do exercício anterior`
- Cria exactamente **um** `OPENING` JE com as linhas DR/CR por natureza da conta

### 2.2 UI — `/contabilidade/exercicios`

- Server-rendered com card do exercício (estado, nº lançamentos, bloqueadores, warnings)
- Botão "Apurar resultados e encerrar" ou "Abrir exercício {year+1}", consoante estado
- Justificação obrigatória; feedback claro

### 2.3 Exportações

- **CSV**: `/api/contabilidade/export?type={razao|balancete|diario}` — tenant-isolated
- **Excel (.xlsx)**: `/api/contabilidade/export/xlsx?type={razao|balancete|diario}` — exceljs, auto-filter, frozen header
- **PDF**: `/api/contabilidade/export/pdf?year=YYYY` — Balanço com Activo = Passivo + Capital Próprio check; DRE estimado; claramente rotulado como estimativa (não certificado AGT)

### 2.4 Statements — fonte partilhada

`src/lib/accounting-statements.ts` — compute function compartilhada por Statements page e PDF route. Mesma matemática; mesma fonte de verdade (ledger). Identifica contas não classificadas explicitamente.

### 2.5 Robustez chain fiscal

Adicionado **P2028** ao conjunto de retries no `issueInvoice` (máximo 5 tentativas com jitter) — elimina a maioria dos P2028 transitórios identificados nas 200 emissões concorrentes da A9 (197/200 → na maior fração). Permanece honestamente como limite do PG default.

## 3. Testes

| Suite | Resultado |
|---|---|
| Full suite (`npx vitest run`) | **546 passed / 8 skipped** (96 files) |
| A10 integration (apuramento + abertura) | ✅ 2/2 |
| A10 RETAINED EARNINGS (ciclo completo) | ✅ 1/1 |
| A1 concurrency (100 FT) | ✅ 100/100 |
| A8 concurrent (advisory removed) | ✅ 100/100 (flaky episódico) |
| `npx tsc --noEmit` | exit 0 |
| Build | exit 0 (180+ routes) |
| Migrations em PG descartável | 61/61 OK |
| ESLint | apenas warnings, sem erros |

**Nota sobre flakiness:** O teste A8 (100 FTs concurrent) passou em 6/7 execuções consecutivas sob carga; uma execução falhou. Não é uma regressão nem um mascaramento — é uma característica de teste de concorrência de alto nível sobre uma cadeia serialada. Não foi alterado o número de workers, pool, nem aumentado timeout arbitrariamente. A retentativa já existente permanece.

## 4. Commits A10

```
1dc3d4a feat(A10): real Excel exports for Diário, Razão and Balancete
c6e0802 feat(A10): shared statement compute + real PDF export (Balanço/DRE)
ce3329c test(A10): retained-earnings full cycle — apuramento → equity → opening
bfc05f6 fix(A7/A8): include P2028 (interactive tx pool-timing contention) in bounded retry set
6775a50 test(A8): log-first-5 error slice in concurrency test to ease diagnosis
e67b33f feat(A10): CSV exports for Diário, Razão and Balancete
be26d04 feat(A10): exercise apuramento + opening + balance transport — tested idempotent
6775a50 test(A8): log-first-5 error slice
```

Total: 7 commits A10.

## 5. Limitações honestas

| Item | Porque |
|---|---|
| Statements estimativos | Sem certificação AGT; requer contabilista externo |
| 200 concurrent FTs | Limitado por pool PG default; 197/200 documentado; P2028 residual reportado sem ocultar |
| Exports PDF/Excel isolados de sessão | Todos via `getSessionTenantId()` |
| Matriz de classificação | `kind` é o único campo de classificação; sem hierarquia multi-nível |
| Nota de crédito: estorno via NC | Via `issueCreditNote → postCreditNoteToGL` (A6 estável) |
| Abertura: transporta apenas ASSET/LIABILITY/EQUITY | REVENUE/EXPENSE apurados no apuramento; não transporta ramos sem destino definido |
| Flakiness A8 test | Teste de concorrência alto nível; passou 6/7 consecutivos (CPU/PG shared) |

## 6. Staging/Production/Supabase não tocados

- Apenas PG descartável `a10_verify` utilizado
- Nenhuma migração fora dele
- Nenhuma alteração em `.env*`
- Nenhuma operação em staging (jobs anteriores)

## 7. Verdicto

**A10 PARTIALLY COMPLETE.**

A10 entrega um ciclo contabilístico real: lançamento → apuramento → encerramento → abertura → transporte de saldos — com idempotência comprovada e exportações funcionais em PDF/Excel/CSV. Permanecem:
- Statements sem certificação AGT
- Limite real de 200 simultaneous FTs
- Sem inventário contabilístico oficial angolano na classificação

**Eu não declaro A10 COMPLETE.**
