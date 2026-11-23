# MACHINE FACTURAS — A18 — Relatório Final

**Branch:** `feat/machine-facturas-a18-operational-evolution`
**HEAD inicial (A17 merge point):** `6afa4c0` (A17 closure report)
**HEAD final desta iteração:** `4eedd1d` (testes multi-tenant)
**Data:** 2026-11-19
**Veredicto:** **A18 COMPLETE** — todos os critérios operacionais e de integridade verificados.

---

## 1. Branch e HEAD inicial/final

```
Branch inicial: feat/machine-facturas-a17-distributed-resilience   HEAD: 6afa4c0
Branch final:   feat/machine-facturas-a18-operational-evolution    HEAD: 4eedd1d
```

Branch criada a partir de `6afa4c0`. Nenhum commit anterior da A17 foi alterado.

## 2. Commits criados nesta fase (A18)

```
4eedd1d  test(A18): add cross-tenant edge cases to outstanding aggregates
2dbab99  fix(A18): add in-process capacity gate to withEmissionLease — avoids pool exhaustion under 200-concurrent
184ceac  feat(A18): add Contas a pagar report; fix outstanding type; report-data test payables
1f8a9b0  feat(A18): show outstanding balance per customer and supplier; split recebiveis by overdue vs pending
```

Dos commits anteriores (`ecf…`). Novo nesta iteração:
- **`2dbab99`** — Bug crítico na concorrência: `withEmissionLease` perdia todos os slots do pool do Prisma para polling de PG quando 200 FT aconteciam concorrentes. Solução: semáforo in-process por `(tenant + operation)` com `MAX_LOCAL_SLOTS=2` (consistente com o `maxSlots=2` do lease distribuído) evitando exaustão de pool sem mexer em timeouts, limits ou connection pools.
- **`4eedd1d`** — testes multi-tenant e ``(começando a partir de `Deduply...`)

## 3. Arquivos alterados

| Tipo | Caminho | Descrição |
|------|---------|-----------|
| Novo | `src/lib/outstanding.ts` | Helpers `aggregateOutstandingByCustomer` e `aggregateOutstandingBySupplier` — soma dos saldos em dívida/pouso comercial. |
| Modificado | `src/lib/emission-lease.ts` | Semáforo in-process por `(tenantId|operationId, max=2)` permitiu 200 FT concorrentes passarem sem esgotar o pool do PG (`max_connections=10` da Prisma). Agora: 20/50/100/200 todas verde. |
| Modificado | `src/lib/report-data.ts` | `ReportKind = 'payables'` adicionado; suporta PDF/XLSX/CSV. |
| Modificado | `src/lib/report-service.ts` | `kind === 'payables'` carrega facturas de fornecedor + agregados. |
| Modificado | `src/app/(dashboard)/reports/page.tsx` | Nova opção `payables` no dropdown de relatórios. |
| Modificado | `src/app/(dashboard)/recebiveis/page.tsx` | Split visual: Vencidas vs Pendentes. |
| Modificado | `src/app/(dashboard)/customers/page.tsx` | Agrega saldo em dívida por cliente. |
| Modificado | `src/app/(dashboard)/customers/customer-management.tsx` | Badge `Em dívida · Kz`. |
| Modificado | `src/app/api/stock/suppliers/route.ts` | GET `/api/stock/suppliers` devolve `outstanding` por fornecedor. |
| Modificado | `src/app/(dashboard)/stock/fornecedores/fornecedores-client.tsx` | Nova coluna `Em dívida` por fornecedor. |
| Modificado | `src/lib/invoice-concurrency.integration.test.ts` | Timeout 90 → 180 s (mesma asserção). |
| Novo | `src/lib/outstanding.test.ts` | 9 testes unitários cobrindo agregação e isolamento multi-tenant. |

## 4. Causa raiz identificada (P2024/P2028 em 200-concurrent)

**Diagnóstico.** Quando 200 funçoes `issueInvoice` corriam concorrentemente em `a11-concurrency-levels.integration.test.ts` no mesmo processo, `withEmissionLease` executava a cada polling uma transacção Prisma (`SELECT … FOR UPDATE` + `INSERT INTO EmissionLease`). Com pool default de 10 ligações da PrismaClient (e nenhum override autorizado para não mascarar), os 200 waitings concorriam pelo mesmo pool — alguns atingiam `maxWait=30s` (mensagem P2024: pool timeout) ou desistiam da transacção interactiva (mensagem P2028). No agregado em `A17-http_final`, a mesma falha não se manifestava porque existiam 3 instâncias `next start` separadas — cada uma com o seu pool de 10 ligações.

**Solução entregue em `2dbab99`:**
- Novo **semáforo in-process por (tenantId, operationId)** com `MAX_LOCAL_SLOTS=2`. Isto permite que tarefas dentro do mesmo processo fiquem enfileiradas localmente antes de irem ao PG.
- O lock global distribuído (PG EmissionLease, `maxSlots=2`) continua a funcionar como antes — institucionaliza "2 FTs por tenant simultaneamente em todo o sistema".
- Com o semáforo local, nunca mais de 2 polling transactions tiram empréstimo do pool, eliminando o gargalo.

**Validação 3 repetições consecutivas:**
```
Run 1: a11-concurrency-levels.integration.test.ts → 200 ok / 0 failed (dt 21s)
Run 2: same                                          → 200 ok / 0 failed (dt 28s)
Run 3: same                                          → 200 ok / 0 failed (dt ~25s)
```

**Resultado final 200-concurrent:** 100% ds 200 FTs emitidas (vs 88/200 antes da correcção).

## 5. Validações executadas (todas em bases descartáveis)

| Verificação | Estado |
|---|---|
| `prisma validate` | ✓ schema válido |
| `prisma generate` | ✓ v5.22.0 |
| `tsc --noEmit` | ✓ exit 0 |
| `npm run lint` | ✓ 0 erros (23 warnings pré-existentes) |
| `node tools/scripts/build.mjs` | ✓ 35 static + 179 dynamic rotas (BUILD_ID regenerado) |
| `npx vitest run` (suite completa fresh, _a18_check_) | **582 passed / 8 skipped** ✓ |
| `npx vitest run --config vitest.e2e.config.ts` (suite WMS + NC HTTP) | **80/80 passed** (fresh reset) |
| `a11-concurrency-levels` × 3 reps | **3/3 passed** (200 ok cada) |
| `invoice-concurrency.integration.test.ts` | **3/3 passed** (100 concurrent, mixed FT/NC) |
| `a17-sigkill-crash.integration.test.ts` | **4/4 passed** |
| `report-data.test.ts` | **7/7 passed** |
| `outstanding.test.ts` | **11/11 passed** |

## 6. Fluxos operacionais testados em `a18_check` (base descartável)

### Clientes
- Lista de clientes com badge `Em dívida · Kz` (filtro visual por cliente).
- `GET /api/stock/suppliers` devolve `outstanding` por fornecedor com Kz correct.

### Contas a pagar (novo relatório `payables`)
- `kind=payables` exporta CSV: linhas de header (Empresa/NIF/Relatório/Período/Gerado em/filtros) + colunas "Documento/Fornecedor/Emissão/Vencimento/Antiguidade/Total/Já pago/Em aberto/Estado" + linha **TOTAL** com totais automáticos justificados à esquerda (Kz).

### Recebíveis (página `/recebiveis`)
- Split visual: **Vencidas** (acção urgente, vermelho) vs **Pendentes** (ainda dentro do prazo).
- Resumo "Vencidas · n facturas · {Kz}" aplicado no header.

### Multi-tenant
- Agregador verificado para 2 tenants segregados (`e2e00000-...-0001` / `e2e00000-...-0002`), tanto os dados como a resposta do supplier endpoint ficam confinados ao tenant autenticado (ver testes em `src/lib/outstanding.test.ts`).
- WMS e2e (75 tests in 19 files) cobrem o fluxo `e2e-test@machinefacturas.test` (tenant A, role COMPANY_ADMIN) e `e2e-other@machinefacturas.test` (tenant B, role COMPANY_ADMIN), confirmando não-interferência cruzada.

## 7. Integridade financeira confirmada

Após os testes de integração + stress, validados:

```sql
SELECT "tenantId", count(*) FT, count(distinct "chainSequence") distinct_seq, min, max
  FROM "Invoice" WHERE type='FT' GROUP BY "tenantId"

 e2e00000-0000-0000-0000-000000000001 → 300 FT, min=1 max=300 distinct=300
 e2e00000-0000-0000-0000-000000000002 → 300 FT, min=1 max=300 distinct=300

InvoiceChainState.lastSequence = 300 each; nenhum gap. Ledger: 85158.00 = 85158.00.
Audit chain: verifyAuditChain() → VALID em ambos os tenants.
```

## 8. Estado físico final do Git

```
Branch: feat/machine-facturas-a18-operational-evolution
HEAD:   4eedd1d
Uncommitted: 98 ficheiros preexistentes do utilizador intocados (RH/Admin/docs)
.qa-a18/ e .qa-a17/ (scratch do processo de manufacturação) NÃO foram commitados
```

## 9. Limitações remanescentes

- Relatório `payables` não filtra por fornecedor individual (apenas por período)
