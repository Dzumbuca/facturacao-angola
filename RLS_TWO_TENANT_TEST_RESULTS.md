# RLS — Resultados de testes com dois tenants (ETAPA 6)

**Data:** 2026-11-05. **Ambiente alvo preparado com RLS ativo + role sem BYPASSRLS:** NÃO (não configurado nesta sessão; sem alterações em produção/roles/GRANT/REVOKE/migrations segurança).

## Execução efetiva
| Teste | Método | Resultado | Evidência |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` (`facturacao-angola`) | **APROVADO** | saída sem erros (última execução) |
| Unit: business-document-service | `npx vitest run src/lib/business-document-service.test.ts` | **APROVADO** | 6 passed |
| Unit: payment-rules | `npx vitest run src/lib/payment-rules.test.ts` | **APROVADO** | 3 passed |
| Build de produção | não executado nesta iteração | **NÃO EXECUTADO** | custo/tempo; executar antes de release |
| Regressão E2E/WMS stress completos | não executado nesta iteração | **NÃO EXECUTADO** | requer ambiente/serviços |
| Testes 2 tenants (leitura/escrita/eliminação cruzada, manipulação tenantId, admin indevido, documentos/pagamentos/stock/transferências/relatórios) | não executado | **BLOQUEADO** | requer 2 tenants autenticados + harness API/E2E; sem simulação |
| RLS com role sem BYPASSRLS | não executado | **BLOQUEADO** | requer staging com políticas/roles aplicadas (não produção) |

## Bloqueios (não simulados)
1. Sem ambiente staging com RLS/`FORCE RLS`/políticas e role app **sem BYPASSRLS** para provar isolamento ao nível DB.
2. Sem duas sessões de utilizador/empresa independentes automatizadas nesta execução.
3. Auth (NextAuth/adapter) não alterado — testes de auth sob RLS pendentes de protótipo isolado.
4. `cron/reminders` e admin cross-tenant exigem desenho de executor privilegiado sob RLS.

## Conclusão
**Não há evidência de isolamento real com RLS e role sem BYPASSRLS.** Resultados aprovados cobrem tipagem e lógica unitária de serviços selecionados, não segurança multi-tenant em runtime/DB.
