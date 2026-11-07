# WMS v2 — Interface Operacional (atualização 2026-11-07)
Branch: `wms-v2-e2e-staging` (ref contexto `95e00366`). Repositório sujo preservado; sem migrations/alterações DB/prod/Supabase/Vercel, sem `git reset/clean/restore`, sem commits abrangentes, sem auditoria RLS retomada.

## Estado
- Backend WMS APIs presentes: armazéns, movimentos, ajustes, transferências, reservas, lotes, compras, recepções, devoluções, saldos, alertas/relatórios.
- P0-1/P0-2/P0-3/P0-4 tratados em sessões anteriores (PWS sem composite unique no schema ? helper transacional com advisory lock em Postgres real, falha explícita em runtime real quando lock indisponível; compat testes; PO sem `warehouseId/notes` no schema, armazém na receção; StockLot alinhado a `lotNumber/expiryDate/receivedAt`; reservas POST com PWS/stock consistência).
- Validação desta entrega: `npx tsc --noEmit` **PASS (0 erros)**; suite WMS/API existente **55/55 PASS** (12 ficheiros): `adjustments,movements,movements/[id],reservations/[id],returns,route,transfers,transfers/[id],purchase/receptions,lots,purchase/orders,reservations,src/lib/stock-service.pws-upsert.test.ts`.

## UI operacional implementada (APIs reais, sem dados fictícios)
- `/stock` — navegação operacional (`StockOperationsNav`) + módulos existentes (movimentos, transferências, armazéns, histórico).
- `/stock/compras` — listagem/criação de ordens (fornecedor, itens, qtd/preço, total, data prevista, estados, recebido/pedido). Usa `GET/POST /api/stock/purchase/orders` e `GET /api/stock/suppliers`.
- `/stock/compras/[id]` — detalhe da ordem, itens pedido/recebido/pendente, estado visual, receção com **armazém obrigatório** e quantidades <= pendente; `POST /api/stock/purchase/receptions` (warehouseId obrigatório, contrato real). Atualiza estado apresentado após receção.
- `/stock/recepcoes` — histórico `GET /api/stock/purchase/receptions` por referência/encomenda/armazém/itens/data.
- `/stock/lotes` — consulta/registo via `GET/POST /api/stock/lots`; validade/expirado/próximo; **limitação explícita**: schema `StockLot` não tem `quantity/manufactureDate` (sem migration).
- `/stock/reservas` — criar/libertar/consumir via `GET/POST /api/stock/reservations` e `PATCH /api/stock/reservations/[id]` (RELEASE/FULFILL), com produto/armazém/qtd/referência/expiração e confirmações.
- `/stock/ajustes` — aumento/redução por produto/armazém, **motivo obrigatório**, confirmação; `GET/POST /api/stock/adjustments`.
- `/stock/devolucoes` — registo de devolução física suportada por `POST /api/stock/returns` (motivo, produto, armazém, qtd, referência/NC opcional); limitação explícita: sem GET dedicado de devoluções.
- `/stock/consultas` — movimentos (`/api/stock/movements`) + saldos (`/api/stock/balances`) com filtros produto/armazém/pesquisa; mostra qtd/reservada/disponível quando disponível.

## APIs mínimas adicionadas/reutilizadas
- `GET /api/stock/suppliers` — tenant-scoped (suporte UI compras).
- `GET /api/stock/products` — tenant-scoped (suporte UI WMS).
- Correção técnica segura (P0-1 residual): `POST /api/stock/balances` usava `productWarehouseStock.upsert` com chave composta inexistente no schema; substituído por lock transacional + `findFirst/update/create` tenant-scoped (sem migration, compat testes).

## Limitações objetivas (não improvisadas)
- `PurchaseOrder` sem `warehouseId/notes` no schema: armazém definido na receção (UI e API refletem isso).
- `StockLot` sem `quantity/manufactureDate`: não apresentados como persistidos.
- Devoluções: `POST /api/stock/returns` suportado; **GET/listagem dedicada não exposta**. Registos administrativos vs físicos dependem do suporte backend; UI atual cobre devolução física autorizada.
- Sem endpoint stock dedicado de produtos em alguns ambientes históricos: UI usa `/api/stock/products` novo (tenant-scoped); validar deploy/rotas.
- Não executados: `next build`, ESLint completo, Playwright/E2E, validação visual manual em browser/staging com dados reais, stress concorrência real em DB.
- `restoreStockForCancelledInvoice` permanece sem ligação automática a fluxos de cancelamento/anulação (P1 backend).
- Sem garantia DB-level de unique PWS `(tenant,product,warehouse,lot)` sem migration; helper mitiga em tx Postgres.

## Pendências recomendadas
1. Confirmar `/api/stock/products` (e `/api/stock/suppliers`) no deploy alvo e permissões.
2. UI opcional: paginação/filtros avançados, listagem de devoluções quando API GET existir, associação de lote em reservas/ajustes se contrato suportar com segurança.
3. E2E/manual em staging (somente com autorização para mutações controladas, se necessário).
4. Se necessário unique PWS/novos campos PO/StockLot: requer decisão + migration autorizada.
