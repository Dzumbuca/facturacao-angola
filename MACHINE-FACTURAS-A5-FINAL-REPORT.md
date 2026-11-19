# MACHINE FACTURAS — FASE A5
## Fecho funcional definitivo do módulo de contabilidade (parte concluída)

**Branch:** `feat/machine-facturas-a5-accounting-completion`
**Branches preservadas:** `main`, `feat/machine-facturas-a1-integrity`, `feat/machine-facturas-a2-erp-consolidation`, `feat/machine-facturas-a3-functional-integration`, `feat/machine-facturas-a4-accounting` — todas intactas.
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a4_test` para tests; `a5_check` para verificar migrations sequencial).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Resultado final

**A5 PARTIALLY COMPLETE** — apresenta um módulo contabilístico utilizável para casos simples. Falta um motor de reconciliação, importação de plano mestre, e a validação AGT.

Funcionalidades entregues:
1. Plano de contas — CRUD com criação/edição/desativação; auditado
2. Períodos e exercícios — UI completa com close/reopen
3. Razão por conta — select da conta, mostra todas as linhas + saldo corrente
4. Balanço e Demonstração de resultados (leitura) — com verificação da equação contábil Activo = Passivo + Capital próprio
5. Auditoria page — lista GlAccountHistory + recentes JournalEntry
6. FT/NC estorno — Nota de Crédito posts autopista com reversão no GL
7. Connection pool resolvido (vitest maxWorkers=1)

Funcionalidades não entregues:
- Motor de reconciliação — requer infraestrutura não-existente (e.g. heuristics para fazer match entre FT/FT-payment/SupplierInvoice/JournalEntry)
- Razão de abertura completa para exercícios anteriores — works only como running tally from inicio da DB
- Multi-currency / conversões
- AGT compliance — não declarado

---

## 2. Estado inicial do projecto

A4 entregue como PARTIAL — tinha plano de contas read-only, períodos, GL core. Faltava:
- Connection pool intermitente sob carga (5–8 testes falhavam aleatoriamente em multi-worker mode)
- UI de gestão de períodos
- UI de gestão do plano de contas
- Razão por conta
- Balanço / DRE
- Auditoria contabilística
- Estorno de FT/NC no GL

---

## 3. Implementação

### 3.1 Connection pool

Configurado `vitest.config.ts` com `maxWorkers: 1` para correr tudo num único processo. Resolveu exaustão intermitente de conexões no PG de testes (originally PG max_connections=100, Prisma default pool=17).

**Migração limpa:** fresh PG com 59 migrations passam sequencialmente sem erros. Sim, isso é provado; executado em `a5_check`.

### 3.2 Plano de contas CRUD — `/contabilidade/plano-contas`

`src/lib/gl-account-actions.ts` server actions:

- `createAccount` — valida unique code per tenant, ciclo de hierarquia via descendência ancestral, kind matches parent kind, nature only DEBIT | CREDIT, com auditoria `GlAccountHistory`
- `updateAccount` — permite mudar nome/kind/nature/synthetic/parentId, bloqueia auto-hierarquia e ciclos
- `deactivateAccount` — bloqueia apagar contas com entradas; permite desativar com entradas se houver (perigoso mas auditado)

Audit action records: CREATE, UPDATE, DEACTIVATE_WITH_ENTRIES, DEACTIVATE

Sidebar: Contabilidade expandido para 8 items (Diário, Plano de contas, Balancete, Períodos, Razão, Auditoria, Balanço/DRE)

### 3.3 Exercícios e períodos UI — `/contabilidade/periodos`

- Auto-criação do exercício corrente e 12 períodos ao abrir a página
- Cada período: OPEN | CLOSED state com botão de fechar/reabrir + prompt com justificativa
- Validação: Reason mínimo de 10 chars para reabrir, 5 chars fechar
- Pre-flight check: Diferença Σ débitos ≠ Σ créditos impede fechar exercício (per closeExercise)

`src/lib/gl-period-actions.ts`:
- `closeExercise(exerciseId, justification)` — exige justificativa ≥5 chars; bloqueia com mensagem se Σ débitos ≠ Σ créditos
- `closePeriod(periodId, justification)` — idem
- `reopenPeriod(periodId, justification)` — exige ≥10 chars

### 3.4 Razão por conta — `/contabilidade/razao`

Lista todas as linhas de uma conta selecionada no dropdown. Saldo acumulado calculado inline. Total de débitos/créditos por conta e saldo final.

### 3.5 Balanço e DRE — `/contabilidade/statements`

Computed from `accounts` grouped by kind. Verifica equação contábil (Activo = Passivo + Capital próprio) com tolerância 0,10 AOA. DRE: Rendimentos − Gastos.

Disclaimers claros: não é apresentação oficial; AGT compliance requer contabilista competente.

### 3.6 Auditoria — `/contabilidade/auditoria`

Dois painéis:
- Alterações ao plano de contas (`GlAccountHistory`) com responsável, ação e timestamps
- Lançamentos contabilísticos com tipo, número, origem e valor
- Isolamento por tenant garantido pelo `getSessionTenantId` (nunca livremente)

### 3.7 FT/NC estorno — `postCreditNoteToGL`

`invoice-service.ts` chamado dentro da NC emission agora executa:
- DR 4000 Vendas (reversão da receita)
- DR 2100 IVA a recolher (reversão do IVA)
- CR 1200 Contas a receber de clientes

Implemented em `postCreditNoteToGL`.

### 3.8 Testes

| Suite | Resultado |
|---|---|
| `npx vitest run` (full, disposable PG) | 538 passing / 0 failing |
| A1 integration (8) | ✅ 8/8 (após reseeding dos tenants de teste ITEST) |
| A2 supplier invoice | ✅ 1/1 |
| A3 GL integration | ✅ 2/2 |
| A4 100 JE parallel | ✅ 100 posts únicos |
| A4 100 FT concurrency | ✅ 100 sucessos |
| `npx tsc --noEmit` | exit 0 |
| `node tools/scripts/build.mjs` | exit 0 (180+ static routes) |
| `npx prisma migrate deploy` (fresh PG) | **59/59 OK** |

(Nota: integration tests podem exigir disposable PG com a DB seed; `DATABASE_URL_A1/A2/A3/A4` apontar para `a4_test`; RH_INTEGRATION_TEST=1 + tenants `e2e00000-...-001/002` seedesets.)

---

## 4. Commits A5

```
1c75fa4 feat(A5): plano-contas CRUD + statements (Balanço & DRE) + auditoria page
0e7a371 feat(A5): FT/NC estorno + periods UI primitives + razão por conta query page
bae8bba test(A5): maxWorkers=1 — single worker process stable integration tests
```

Total commits A5: 3 (4 se contar o setup inicial).

## 5. Limitações (honestas)

| Item | Porque |
|---|---|
| Motor de reconciliação | Não implementado. Um sistema de matching automático entre documento/lançamento requer decisões de negócio que não devem ser feitas sem conhecimento contabilístico e de negócio do utilizador. |
| Razão com saldo inicial histórico | Atualmente começa do início da DB; filtros por exercício não são suportados |
| Chart of accounts bulk import | Não implementado |
| Multi-currency | Não implementado |
| Trial balance por período | Balancete trabalha em modo leitura agregada; não há filtros de período |
| Statements oficiais (Balanço / DRE) | Estimativa analista sem AGT compliance |
| Períodos sobrepostos | Validação básica via unique exercisesões; não há verificação cruzada avançada |
| Auditoria page não percorre JournalEntry devessor | Provavelmente suficiente para utilizador; falta imprensa ikalme petecode pubbase |
| AGT compliance | **NÃO declarada.** Processo externo obrigatório com contabilista certificado |

## 6. Staging/Production/Supabase não tocados

- Nenhum arquivo `.env`, `.env.staging`, `.env.production` foi lido ou modificado
- Nenhuma migration aplicada a staging nem produção
- Nenhum deploy iniciado ou planeado
- Validação apenas em PostgreSQL descartável

## 7. Verdict

**A5 PARTIALLY COMPLETE.**

Existe agora um módulo contabilístico utilizável para empresas Angolanas com configuração simples. Mas para uso em produção real, faltam:

1. Certificação AGT documentada
2. Plano mestre importado e revisado por contabilista
3. Procedure documentada para fecho de períodos e migração anual
4. Motor de reconciliação ou passagem para Excel-based reconciliation com workflow clara

**Eu não declararia A5 completo — falta maturidade.**
