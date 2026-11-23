# MACHINE FACTURAS — FASE A6
## Reconciliação financeira, plano de contas e validação contabilística integral

**Branch:** `feat/machine-facturas-a6-reconciliation`
**Origem:** `feat/machine-facturas-a5-accounting-completion` (HEAD `bf69a7c`)
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a6_test`).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Resultado final

**A6 PARTIALLY COMPLETE.**

O motor de reconciliação funciona; o plano de contas CSV funciona; os estornos FT/NC estão inteiros. Falta stress tests de concorrência em reconciliação, e alguns filtros em relatório.

Entregas:
1. Motor de reconciliação persistente com idempotência — `ReconciliationRun + ReconciliationIssue`
2. UI de reconciliação em `/contabilidade/reconciliar`
3. CSV import para plano de contas em `/contabilidade/plano-contas/importar`
4. Razão por conta torna saldos primário claro
5. NC estorno correcto no GL (DR 4000/DR 2100/CR 1200)

Limitações:
- Razão não trabalha para exercícios anteriores (rebuild requer trabalho adicional)
- Balancete não filtra por exercício/período
- Statements (Balanço/DRE) são estimativas — não usam classificação especializada
- AGT conformidade NÃO declarada

---

## 2. Estado inicial do projecto

A5 introduziu: plano mestre via CRUD manual + períodos + razão + statements primitivos.

Lacunas identificadas:
- Nenhuma reconciliação formal entre documentos e lançamentos
- Plano mestre apenas manual (sem importação em massa)
- Estorno NC presente, mas sem teste de integração end-to-end

---

## 3. Implementação

### 3.1 Motor de reconciliação — `ReconciliationRun` e `ReconciliationIssue`

Migration `20261121000000_a6_reconciliation` adiciona duas tabelas:
- `ReconciliationRun(id, tenantId, startedAt, finishedAt, status, rulesClaimed, issuesFound, actorUserId)`
- `ReconciliationIssue(id, tenantId, runId, issueType, docKind, docId, value, description, severity, state, resolvedAt, resolvedBy, justification, createdAt)`
- Composite FKs (tenantId, runId) com CASCADE DELETE

### 3.2 Serviço — `src/lib/reconciliation-service.ts`

`runReconciliation(tenantId, actorUserId)`:

Rules (7):
1. FT without JE
2. Customer payment without JE
3. SupplierInvoice without JE
4. Paid SI without JE reversal
5. REVERSED customer payment without estorno
6. NC without JE estorno
7. Supplier invoice overdue (informational)

Cada run cria um `ReconciliationRun` row; issues persistidas; estado `OPEN`. Subsequente execução cria novo run — issues de runs anteriores preservadas (mas marca como histórico). A query uses raw SQL para garantir contagens = `No duplicate issues per rule per run.`

### 3.3 API endpoint `POST /api/contabilidade/reconciliar` — dispara run + returns immediately

Calls `runReconciliation`. Tenant check via `getSessionTenantId`.

### 3.4 UI `/contabilidade/reconciliar`

Mostra:
- Última execução (status, iniciada, regras, divergências)
- Lista de divergências em aberto com severidade (HIGH/MEDIUM/LOW), valor, descrição, data de criação
- Botão "Executar reconciliação" (POST /api/contabilidade/reconciliar)
- Disclaimers: sem correção automática

### 3.5 Plano de contas import — `src/lib/gl-account-actions.ts` (extended)

`importChartOfAccounts(csv)`:
- CSV format: `code;designation;kind;nature;parentCode;synthetic`
- Validações: code 4–20, name ≥3 chars, kind ∈ {ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE}, nature ∈ {DEBIT, CREDIT}, parent existence (in DB or same CSV), duplicate detection, cycle-free through parent hierarchy
- Idempotente: duplicates skipped silently
- Transaccional: tudo ou nada (errors returned ⇒ caller must retry with fix)
- Auditado: cada row cria `GlAccountHistory` entry

`/contabilidade/plano-contas/importar` — page + form para paste CSV.

### 3.6 Estornos FT/NC — Nota de Crédito posta por `issueCreditNote` agora também reverte no GL

`postCreditNoteToGL` adiciona estorno: DR 4000 / DR 2100 / CR 1200.

`postCreditNoteToGL` tested via `a1 FT + NC` integration suite (passes).

### 3.7 Verificação de testes

| Suite | Resultado |
|---|---|
| `npx vitest run` (full, disposable PG) | **540 passing / 8 skipped** |
| Integration tests (R7 e A4, A3, A2) | ✅ 9/9 |
| `npx prisma migrate deploy` (fresh PG) | **60/60 OK** |
| `npx tsc --noEmit` | exit 0 |
| `node tools/scripts/build.mjs` | exit 0 (180+ routes) |
| `npx tsc` on/edits | clean |

---

## 4. Commits A6

```
2a29a05 feat(A6): CSV import for plano de contas with validation + audit
3c8442c test(A6): integration tests for reconciliation engine
9071c4a feat(A6): reconciliation engine + UI + API endpoint
```

Total: 3.

---

## 5. Verdict

**A6 PARTIALLY COMPLETE.**

O motor de reconciliação funciona, o CSV import funciona, os estornos FT/NC estão corretos. Implementar:

- Filtros por exercise/período em todos os reports (hoje só em Razão)
- Stress tests de concurrency em reconciliação
- Schema de Balancete por exercício
- Plano de contas Markened II_MRU paths precision fix

Sem bloqueador técnico — só tempo e escopo.

O que falta para completo:
- Motor de reconciliação com feedback loop ("resolve" → auto-fechar issue pelo utilizador)
- Statements oficiais (Balanço/DRE) com validação AGT externa com contabilista
- Stress test com 200+ operações concorrentes simultâneas em PG descartável

## 6. Staging/Production/Supabase não tocados

- Nenhum ficheiro `.env`, `.env.staging`, `.env.production` foi tocado
- Nenhuma migration aplicada a staging ou produção
- Nenhum deploy iniciado ou planeado
- Apenas PG descartável `a6_test` utilizado

## 7. Confirmation of constraints

- A1/A2/A3/A4/A5 branches preservadas — não alteradas
- Nenhuma configuração ou sigilo manipulado
- Migrations apenas no disposable PG
- Nenhuma transacção realizada fora dos PG de teste

**Eu não declaro A6 como completo. Depende de validação especializada externa.**
