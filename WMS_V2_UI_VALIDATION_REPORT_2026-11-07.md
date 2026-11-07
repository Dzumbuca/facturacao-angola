# WMS v2 — Relatório de Validação UI (2026-11-07)
Projeto: `C:\Users\Administrador\Desktop\facturacao-angola`  
Branch: `wms-v2-e2e-staging` (suja, alterações preexistentes preservadas).  
Restrições cumpridas: sem migrations/schema DB, sem prod/Supabase/Vercel, sem `git reset/clean/restore`, sem commits, sem auditoria RLS retomada, sem mutações em staging sem autorização explícita.

## 1) Build e qualidade
| Item | Resultado | Notas |
|---|---|---|
| `next build` (Turbopack) | **PASS** (após correção) | Falha inicial por encoding UTF-8 inválido (PowerShell `Set-Content` default) nos ficheiros UI WMS novos; ficheiros regravados como UTF-8 sem BOM. Build final concluiu e gerou rotas dinâmicas WMS. |
| Rotas WMS no build | **OK** | `/stock`, `/stock/ajustes`, `/stock/compras`, `/stock/compras/[id]`, `/stock/consultas`, `/stock/devolucoes`, `/stock/lotes`, `/stock/recepcoes`, `/stock/reservas` presentes como dynamic (`ƒ`). |
| `tsc --noEmit` (validação anterior nesta sessão) | **PASS** | 0 erros reportados após implementações/correções. |
| ESLint (ficheiros alterados WMS) | **BLOQUEADO por tooling preexistente** | `npx eslint ...` falhou com `ERR_MODULE_NOT_FOUND` ao importar `eslint` a partir de `eslint.config.mjs` (ambiente/npx não resolve dependência local esperada). Binário local `eslint` não confirmado no passo rápido. Não é erro introduzido pelos ficheiros WMS; não foram feitas correções indiscriminadas em problemas preexistentes. |
| Suite WMS/API existente | **55/55 PASS** (12 files) | `adjustments,movements,movements/[id],reservations/[id],returns,route,transfers,transfers/[id],purchase/receptions,lots,purchase/orders,reservations,src/lib/stock-service.pws-upsert.test.ts`. |

## 2) Validação visual (browser/Playwright)
| Página | Estado | Evidência |
|---|---|---|
| `/stock` | **Parcial (build/rotas OK; visual manual não executado)** | Rota gerada no build; sem captura Playwright executada nesta sessão. |
| `/stock/compras` | **Parcial** | Rota gerada; UI usa APIs reais; sem validação visual interativa automatizada. |
| `/stock/compras/[id]` | **Parcial** | Rota dinâmica gerada; fluxo de receção implementado no código; sem validação visual interativa. |
| `/stock/recepcoes` | **Parcial** | Rota gerada. |
| `/stock/lotes` | **Parcial** | Rota gerada. |
| `/stock/reservas` | **Parcial** | Rota gerada. |
| `/stock/ajustes` | **Parcial** | Rota gerada. |
| `/stock/devolucoes` | **Parcial** | Rota gerada. |
| `/stock/consultas` | **Parcial** | Rota gerada. |

**Motivo:** Playwright/e2e de UI para estas páginas não existe no repositório (não foi criada suite nova). Arrancar servidor local para browser pode ligar a DB configurada em `.env.local` (metadata inspecionada de forma mascarada; não exposta). Para evitar risco e cumprir “sem mutações em staging sem autorização explícita / preferencialmente sem escritas em bases de dados reais”, não executei fluxos mutantes em browser contra DB real.

## 3) Validação funcional (fluxos críticos)
| Fluxo | Estado | Base |
|---|---|---|
| 1. Criar ordem de compra | **Não confirmado em runtime real** | API `POST /api/stock/purchase/orders` tem testes (4/4) e UI chama endpoint real; sem execução E2E com DB isolada autorizada. |
| 2. Consultar ordem | **Não confirmado em runtime real** | Página server `compras/[id]` tenant-scoped (`purchaseOrder.findFirst({id,tenantId})`); build ok. |
| 3. Recepção parcial | **Contrato coberto por testes; runtime real não confirmado** | `POST /api/stock/purchase/receptions` atualizado para schema real, `receivedQty`/`PARCIAL`, warehouse obrigatório (9 testes PASS). UI envia `warehouseId`+itens+qtd. |
| 4. Estado PARCIAL | **Coberto por teste de rota** | Teste “sucesso…” espera `status: PARCIAL` quando pendente. |
| 5. Receção restante | **Parcialmente coberto** | Lógica calcula `RECEIVED` + `receivedAt` quando `receivedQty >= quantity`; caso total não isolado num teste novo nesta sessão (parcial coberto). |
| 6. Estado RECEIVED | **Parcialmente coberto** | Código implementa; teste explícito de transição completa não adicionado. |
| 7. Saldos/movimentos após receção | **Contrato coberto; runtime real não confirmado** | Rota atualiza `Product.stock`, `ProductWarehouseStock` (helper seguro), cria `StockMovement IN` com `purchaseReceptionId`/idempotency. Consultas UI leem `/api/stock/movements` e `/api/stock/balances`. |
| 8. Criar/libertar reservas | **Coberto por testes API** | `POST /api/stock/reservations` (6 testes) + `PATCH /api/stock/reservations/[id]` (8 testes): PWS/reserved/Product consistency, RELEASE com `releasedAt`. UI chama endpoints reais. |
| 9. Ajustes | **Coberto por testes API** | `POST /api/stock/adjustments` (3 testes), motivo/warehouse/itens validados no backend; UI exige motivo e confirmação. |
| 10. Lotes e devoluções | **Coberto parcialmente** | Lotes `POST` (5 testes, schema-aligned, sem `quantity/manufactureDate`). Devoluções `POST /api/stock/returns` usa `registerPhysicalReturn` (fluxo existente/testes suite relacionados presentes); UI exige motivo/confirmação; **sem GET/listagem devoluções**. |

## 4) Auditoria de integração
| Verificação | Resultado |
|---|---|
| APIs corretas por página | **OK no código** — Compras: `/api/stock/purchase/orders`,`/api/stock/suppliers`,`/api/stock/products`; Receção: `/api/stock/purchase/receptions`; Lotes: `/api/stock/lots`; Reservas: `/api/stock/reservations(+/id)`; Ajustes: `/api/stock/adjustments`; Devoluções: `/api/stock/returns`; Consultas: `/api/stock/movements`,`/api/stock/balances`; Nav/apoio: `/api/stock/warehouses`. |
| Autenticação/permissões | **Parcial** — APIs usam `auth()` + `getSessionTenantId()` e `runWithTenant`/tenant checks (padrão do projeto). UI trata erros HTTP; não testado login real/E2E. |
| Isolamento por tenant | **OK no contrato backend auditado** — queries/updates com `tenantId`; PWS helper recebe `tenantId`; páginas server carregam por `tenantId`. Não validado com 2 tenants reais em browser. |
| Dados fictícios | **OK** — sem mocks na aplicação; UIs consomem APIs/Prisma server data. |
| Navegação | **OK** — `/stock` tem `StockOperationsNav` para compras, recepções, lotes, reservas, ajustes, devoluções, consultas; detalhe compra liga a receções. Menu global “Armazéns” (`/warehouses`) permanece separado (não duplicado). |
| Funcionalidades apenas visuais/parciais | **Sim, identificadas** — Devoluções: registo POST funcional conforme API; **sem listagem/consulta dedicada** (GET não exposto). Consultas: visão unificada, mas paginação limitada (200 movimentos) e filtros dependem de payload atual. Criação PO: depende de fornecedores/produtos carregáveis (`/api/stock/suppliers`, `/api/stock/products` novos). |
| Risco técnico residual encontrado | `POST /api/stock/balances` foi corrigido (removido upsert por chave composta inexistente no schema). |

## 5) Capturas de ecrã
Não capturadas (sem execução Playwright/browser automatizada contra ambiente seguro).

## 6) Pendências para aprovação final
1. **Autorizar/definir ambiente isolado** para E2E com mutações controladas (DB local/teste descartável ou staging com IDs/rollback aprovados) e executar fluxos 1–10 em browser/API real.
2. Adicionar teste de rota explícito para transição **PARCIAL ? RECEIVED** (duas recepções) e verificação de saldos/movimentos agregados.
3. Resolver ESLint tooling (`eslint` resolvível pelo config) e rodar lint focado nos ficheiros WMS alterados.
4. Validar visualmente em mobile/desktop: formulários longos, tabelas overflow, estados vazios/erro/carregamento, confirmação de ações destrutivas/stock.
5. Confirmar disponibilidade em deploy de `GET /api/stock/products` e `GET /api/stock/suppliers`.
6. Devoluções: implementar `GET`/listagem quando API/decisão de negócio estiver definida (sem migration implícita indevida).
7. Backend P1: `restoreStockForCancelledInvoice` ainda não ligado a cancelamento/anulação de fatura (fora do escopo UI desta entrega).
8. Garantia DB-level de unique PWS exige migration autorizada (helper transacional é mitigação app-level).

## Conclusão (objetiva)
**WMS v2 UI não deve ser declarado concluído** para uso real sem validação funcional/runtime em ambiente seguro: build e testes API relevantes passaram (55/55), rotas foram geradas, e contratos críticos de compras/recepções/reservas/ajustes/lotes estão cobertos por testes de API; porém fluxos E2E com dados reais/isolados, validação visual Playwright/browser e lint executável ficaram parciais/bloqueados pelas restrições e tooling.
