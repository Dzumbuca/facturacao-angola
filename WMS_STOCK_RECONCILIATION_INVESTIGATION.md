# Divergência sintética de stock — PROD-A-SYNTH (ETAPA 5, investigação; SEM --apply)

**Alvo:** staging local `.env.playwright` / `127.0.0.1:5436/wms_staging` (consulta read-only via Prisma). **Nenhuma correção aplicada.**

## Evidência
- Tenant `11111111-1111-1111-1111-111111111111`, produto `pppppppp-pppp-pppp-pppp-pppppppppppp` `PROD-A-SYNTH` / `Produto A (SYNTHETIC)`:
  - `Product.stock = 50.000`
  - `SUM(ProductWarehouseStock.quantity) = 10.000` (1 linha: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, qty `10.000`, sem lote)
  - `StockMovement` count = `0`, `SUM(quantitySigned)=0`
- Controlo mesmo dataset: `PROD-B-SYNTH` (tenant 2222...) consistente (`stock=30`, wh_sum `30`, sem movimentos).

## Origem provável
Inconsistência de **seed/dados sintéticos/manipulação direta**: `Product.stock` foi definido/ficou em `50` enquanto o saldo por armazém (`ProductWarehouseStock`) representa `10` e **não existem movimentos** que expliquem a diferença (+40). Isso indica que os contadores não foram derivados da mesma fonte transacional (ou seed parcial). Não é evidência de bug de runtime atual sem reprodução.

## Movimentos envolvidos
Nenhum (`StockMovement` = 0 para o produto). Logo não há trilha transacional para justificar `delta = wh_sum - Product.stock = -40`.

## Alternativas de correção (NÃO EXECUTADAS)
| Opção | Ação | Risco | Quando usar |
|---|---|---|---|
| A — alinhar `Product.stock` ao armazém | `Product.stock := SUM(ProductWarehouseStock)=10` | Baixo se PWS for fonte de verdade; pode mascarar stock “global” não alocado | Dados sintéticos/teste; PWS confiável |
| B — alinhar PWS ao produto | criar/ajustar PWS em armazém conhecido para totalizar 50 | Médio: escolhe armazém/lote; cria estado sem movimento | Só com regra de negócio clara |
| C — movimento corretivo | inserir ajuste/movimento auditável + atualizar contadores | Médio: altera histórico; requer idempotência/tenant/ctx | Quando correção deve ser auditável |
| D — investigar/manual | confirmar origem no seed/script antes de tocar | Nenhum | Padrão seguro (recomendado) |

## Recomendação
Tratar como dado sintético inconsistente: **D** (confirmar seed/origem). Se for apenas ruído de staging, **A** com script seguro transacional (`--apply` explícito, tenant/produto fixos, backup/preview, auditoria) — **aguarda autorização**. `scripts/wms-reconcile-stock.cjs` atual é dry-run; extensão `--apply` exigiria salvaguardas.
