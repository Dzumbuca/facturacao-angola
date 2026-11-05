# RLS — Compatibilidade WMS/Stock (ETAPA 2)

## Cobertura
Rotas `src/app/api/stock/*` (19 route files). Maioria já usava `runWithTenant` + auth tenant (`getTenantReadAccess`/`getTenantWriteAccess`/`getSessionTenantId`).

| Estado | Rotas/áreas |
|---|---|
| OK (tenant ctx + auth) | `route.ts`, `adjustments`, `balances`, `lots`, `movements`, `movements/[id]`, `purchase/orders`, `purchase/receptions`, `reports`, `reservations`, `reservations/[id]`, `transfers`, `transfers/[id]`, `warehouses`, `warehouses/[id]` |
| OK (delega a serviço tenant-scoped) | `alerts`→`getLowStockAlerts`, `report`→`getStockValuationReport`/`getStockRotationReport`, `returns`→`registerPhysicalReturn` (ver `stock-service.ts`) |
| **Corrigido** | `purchase/route.ts`: passa `userId` autenticado a `registerStockEntry`; remove confiança em `createdByUserId` vindo do body para contexto/auditoria. |

## `stock-service.ts`
Funções críticas (`registerStockEntry`, `registerPhysicalReturn`, `getLowStockAlerts`, valuation/rotation, movimentos/ajustes/transferências conforme implementado) operam com `runWithTenant`/`tx` tenant — compatíveis com preparação RLS.

## Queries Prisma globais sem contexto tenant
Não identificadas nas rotas WMS auditadas após correções (varrimento textual). **Exceção de análise:** sempre confirmar sub-caminhos novos antes de ativar RLS.

## Lógica de negócio preservada
Correção em `purchase` altera apenas origem de `createdByUserId/contextUserId` (servidor). Quantidade/warehouse/produto/validações inalteradas.
