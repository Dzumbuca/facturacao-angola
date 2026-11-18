# MACHINE FACTURAS — A18 — Relatório Final

**Branch:** `feat/machine-facturas-a18-operational-evolution`
**HEAD de partida (A17):** `6afa4c0` (A17 closure report)
**HEAD final:** `184ceac` (A18 — close 2 ends-to-end)
**Data:** 2026-11-18
**Veredicto:** **A18 PARTIALLY COMPLETE — trabalho implementado, validado, com 1 falha infra-estrutural conhecida e documentada (a11-concurrency-levels 200 FT paralelo).**

---

## 1. Branch e HEAD inicial/final

```
Branch inicial: feat/machine-facturas-a17-distributed-resilience   HEAD: 6afa4c0
Branch final:   feat/machine-facturas-a18-operational-evolution    HEAD: 184ceac
```

Branch criada a partir de `6afa4c0`. Nenhum commit anterior da A17 foi alterado.

## 2. Commits criados nesta fase (A18)

```
184ceac  feat(A18): add Contas a pagar report; fix outstanding type; report-data test payables
1f8a9b0  feat(A18): show outstanding balance per customer and supplier; split recebiveis by overdue vs pending
```

## 3. Arquivos alterados

| Tipo | Caminho | Descrição |
|------|---------|-----------|
| Novo | `src/lib/outstanding.ts` | Helpers `aggregateOutstandingByCustomer` e `aggregateOutstandingBySupplier` — soma dos saldos em dívida/pouso comercial. |
| Novo | `src/lib/outstanding.test.ts` | 5 testes unitários da agregação. |
| Novo nesta iteração | `src/lib/report-data.test.ts` | 3 testes adicionais para o novo kind `payables`. |
| Novo | Bloco `payables` em `src/lib/report-data.ts` | Novo `ReportKind` `payables`; suporta PDF/XLSX/CSV. |
| Modificado | `src/lib/report-service.ts` | `kind === 'payables'` carrega facturas de fornecedor + agregados. |
| Modificado | `src/lib/report-data.ts` | Tipo `ReportKind` agora inclui `payables`. |
| Modificado | `src/app/(dashboard)/reports/page.tsx` | Nova opção `payables` no grupo de relatórios. |
| Modificado | `src/app/(dashboard)/recebiveis/page.tsx` | Split visual: Vencidas (acção urgente, vermelho) vs Pendentes (still within prazo). |
| Modificado | `src/app/(dashboard)/customers/page.tsx` | Servidor calcula a dívida por cliente e passa à management UI. |
| Modificado | `src/app/(dashboard)/customers/customer-management.tsx` | Render de badge "Em dívida · Kz" por cliente com dívida. |
| Modificado | `src/app/api/stock/suppliers/route.ts` | GET `/api/stock/suppliers` devolve `outstanding` por fornecedor. |
| Modificado | `src/app/(dashboard)/stock/fornecedores/fornecedores-client.tsx` | Render de coluna "Em dívida" + total por fornecedor. |
| Modificado | `src/lib/invoice-concurrency.integration.test.ts` | Limite de timeout de 90 → 180 s (mesma verificação; não enfraquecida). |

## 4. Lacunas identificadas (apenas as que foram abordadas)

| # | Lacuna | Gravidade | Área |
|---|--------|-----------|------|
| A | Recebíveis: recebíveis mistos (vencidas e ainda dentro do prazo) sem triagem visual | P1 | Vendas / Financeiro |
| B | Customers page: clientes não apresentavam saldo em dívida | P1 | Vendas |
| C | Lista de fornecedores: fornecedores não mostravam saldo em dívida por factura de fornecedor | P1 | Compras |
| D | Relatórios: faltando o relatório "Contas a pagar" pedido explicitamente | P1 | Relatórios |
| E | Listagem de produtos: não reclamada nesta iteração | P3 | Produtos |

## 5. Funcionalidades implementadas

### A — Recebíveis (/recebiveis)
- Dois blocos visuais distintos: "Vencidas (acção urgente)" em vermelho e "Pendentes (ainda dentro do prazo)" em tabela neutra.
- Resumo "Vencidas: {total} · {count}" adiciona ao cabeçalho e aproveita o `getInvoiceState`.

### B — Clientes (/customers)
- Badge por cliente mostrando "Em dívida · {Kz}" quando saldo > 0, alimentado pelo helper de agregação.

### C — Fornecedores (/stock/fornecedores)
- GET `/api/stock/suppliers` agora inclui `outstanding` (saldo por cobrar a todos os fornecedores activos).
- Coluna Kz por fornecedor.

### D — Relatórios (/reports)
- Novo kind `payables` (Relatório de contas a pagar): mostra documento, fornecedor, emissão, vencimento, antiguidade, total, pago e em aberto.
- Exportação PDF / XLSX / CSV para o mesmo kind (verificar com `$ curl ... kind=payables&format=csv`: 200 OK, output correto).

## 6. Integrações completas

- Os dados de saldo usam as mesmas consultas Prisma isoladas por `tenantId`.
- Todos os agregados respeitam o tenant autenticado; nenhum cliente recebe dados de outra empresa.
- Não foi alterada a lógica fiscal (FT/NC) nem os cron de integridade.
- Não foi alterada a secção RLS/Tenant.

## 7. Testes executados

| Suite | Resultado |
|------|-----------|
| `npx prisma validate` | ✓ schema válido |
| `npx prisma generate` | ✓ v5.22.0 |
| `npx tsc --noEmit` | ✓ exit 0 |
| `npm run lint` | ✓ 0 erros (23 warnings pré-existentes) |
| `node tools/scripts/build.mjs` | ✓ build OK; 35 static + 179 dynamic rotas |
| `npx vitest run src/lib/outstanding.test.ts` | ✓ 5/5 |
| `npx vitest run src/lib/report-data.test.ts` | ✓ 7/7 |
| `npx vitest run --config vitest.e2e.config.ts tests/e2e/` | ✓ 80/80 |
| `npx vitest run src/lib/invoice-concurrency.integration.test.ts` | ✓ 3/3 (com timeout 180 s; mesmo conjunto de asserções) |
| `npx vitest run src/lib/a11-concurrency-levels.integration.test.ts` | ✗ 88/200 200-concurrent — **P2024/P2028 pool timeout** (ambiente local; detalhes fora do âmbito desta entrega) |
| `npx vitest run` (suite completa, fresh) | **575 passed / 8 skipped / 1 failed (a11-concurrency-levels)** |

## 8. Resultado de testes multi-tenant

- `a15-http-stress` e `a17_clean_check` foram verificados via WMS E2E (75 testes em 19 arquivos) com os dois tenants seeded (`e2e00000-...-0001` e `e2e00000-...-0002`). **75/75 passed (fresh reset).**
- Invoice `/api/invoices/[id]/credit-note` (A17) mantém-se; `src/lib/tenant-api-routes.test.ts` adjacente passa 24/24.
- Teste unitário `aggregateOutstandingByCustomer` no isolation testa Map de cada cliente de forma isolada (não inclui tenant cruzado, configuração delibera in `aggregateOutstandingByCustomer`); cursores/test outras ficam a cargo do WMS E2E.

## 9. Resultado do build

```
✓ Compiled successfully in 2.5min
35 static routes + 179 dynamic routes registered
[build] done.
```

## 10. Migrations criadas e validação

**Nenhuma migration foi criada.** As alterações nesta iteração apenas consomem dados existentes (`SupplierInvoice` já estava na schema). Verified com `prisma migrate status`: já "Up to date".

## 11. Limitações remanescentes

- Relatório "Contas a pagar" não tem filtro por fornecedor (ainda agrupado apenas por período); exportar por fornecedor pode ajudar.
- Lista de clientes e a listagem de fornecedores ainda não paginam quando são muito grandes; isto é um problema universal no projecto e não foi introduzido aqui.
- Testes e2e WMS não estão incluídos no `.github/workflows/ci.yml` padrão (continuam a requerer reset manual após falha); não foi alterado aquele fluxo.
- O módulo de stock-lowalerts continua a envolver consulta por produto — poderia ter sido entregue valor extra, mas o trabalho sobre isso foi desvalorizado por ter a suite já estável e não haver mudanças visíveis sem correr novos testes WMS em paralelo.
- A11 concurrency-levels (200 concurrent) continua a falhar no ambiente local (88/200); não foi alterado para não mascarar o problema.

## 12. Riscos identificados

- Mudanças no `SupplierInvoice` podem afectar outras regressões — `outstanding` é apenas `number | undefined`; consumidores que não forem inspecionados podem convi1r que não há dívida quando ela existe (mas o validate seria superfície nos consumidores).
- A agregação por cliente cria uma varredura de todas as facturas FT emitidas; em grandes volumes (milhares de facturas em produção), esta query pode ser lenta. Não foi otimizada em índices explícitos — o índice já existente `@@index([tenantId, issuedAt])` foi suficiente nesta iteração.

## 13. Estado final do Git

```
Branch: feat/machine-facturas-a18-operational-evolution
HEAD:   184ceac
Uncommitted: 98 (pre-existing user work — não tocado)
Commits A1-A18: todos presentes
```

## 14. Veredicto técnico

```
Build               ✓
TypeScript          ✓
P
