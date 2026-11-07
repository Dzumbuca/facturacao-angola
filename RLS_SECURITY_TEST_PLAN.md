# Plano de testes de segurança RLS/multi-tenant (ETAPA 4)

**Pré-condições:** ambiente de teste/staging isolado; >=2 empresas (A,B) com utilizadores distintos; dados de seed controlados; logs/auditoria acessíveis. **Não executar em produção.**

## Matriz de testes (app + preparação RLS)
| Caso | Ação (como tenant A) | Esperado | Estado |
|---|---|---|---|
| Consulta cruzada clientes | GET `/api/customers` / por ID de B | Apenas dados A; ID B => 404/sem dados | PENDENTE |
| Consulta cruzada produtos | GET/PATCH produto de B | 404/negado | PENDENTE |
| Consulta cruzada rascunhos/faturas | GET draft/invoice de B | 404/negado | PENDENTE |
| Alteração cruzada | PATCH/PUT com ID de B | 404/409 sem efeito em B | PENDENTE |
| Eliminação cruzada | DELETE cliente/produto/doc de B | 404/sem efeito | PENDENTE |
| Alteração de tenantId | Body/header tenta forçar `tenantId=B` | Ignorado; usa tenant da sessão; sem escalada | PENDENTE |
| Stock/armazéns | movimentos/ajustes/transferências/relatórios, IDs B | Isolado; relatório sem dados B | PENDENTE |
| Pagamentos | acesso a pagamentos/planos de B | Negado/isolado | PENDENTE |
| Relatórios | `/api/stock/reports`, business reports | Somente tenant A | PENDENTE |
| Admin | operações admin com utilizador não-admin | 403 | PENDENTE |
| Admin cross-tenant | admin autorizado lista/atua globalmente | Apenas conforme permissão explícita + auditável | PENDENTE |

## Validação com role sem BYPASSRLS (quando ambiente preparado)
- Repetir casos acima com role app **sem** `BYPASSRLS` e RLS/políticas aplicadas no alvo de teste.
- Verificar GUC `app.tenant_id` definido por request/transação (`runWithTenant`).
- Confirmar pooling compatível (transaction pooling vs GUC `LOCAL`/`SET LOCAL`).
- Capturar falhas e mapear para `RLS_TENANT_ISOLATION_MATRIX.md`.

## Evidência mínima por teste
request ID/endpoint, tenant/user, payload, status/resposta, verificação DB (somente staging), resultado aprovado/reprovado.

## Bloqueio atual
Execução automatizada completa não realizada nesta sessão (requer duas sessões/empresas autenticadas, ambiente preparado e/ou role sem BYPASSRLS). Parcial local: `tsc --noEmit` OK.
