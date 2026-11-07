# RLS_PRODUCTION_READINESS.md
## Estado
**NÃO PRONTO PARA PRODUÇÃO.** Evidências positivas existem **apenas** em PostgreSQL local independente `mf_rls_staging` (`127.0.0.1:5437`), role `mf_app_login` **NOBYPASSRLS**. Produção Supabase **não alterada**. WMS staging `5436/wms_staging` **não alterado**. Nenhuma migration/reset/destruição. Nenhum push/merge.

## Evidência executada (PASS)
| Critério | Estado | Evidência |
|---|---|---|
| Runtime Next usa DB/role esperada (5437, NOBYPASSRLS) | **PASS** | `tmp/rls-e2e-artifacts/runtime-db-identity.json` (temp route, removed): `mf_rls_staging,mf_app_login,rolsuper=false,rolbypassrls=false,tenant_rls=true,app context matches session` |
| Auth credentials A/B + admin fixture + sessões independentes | **PASS** | `http-isolation-ab-extended.json`, `http-auth-admin-probe.json` |
| Logout invalida sessão (caso executado) | **PASS** | `http-auth-admin-probe.json` |
| Isolamento HTTP A/B (produtos/armazéns/clientes, cross-ID GET/PATCH bloqueado sem leak) | **PASS** | `http-isolation-ab-extended.json` (23/23) |
| Unauth bloqueado (amostras) | **PASS** | produtos 401/403; plan payment 401 |
| Isolamento RLS PostgreSQL real (DB) | **PASS** | 19/19, 60/60, 5/5 |
| Cobertura RLS/policies (5437, evidência existente) | **PASS parcial** | 51 modelos presentes, 47 tabelas RLS ON/1 policy, 4 adapter RLS OFF protótipo |
| Defeito real corrigido | **PASS (validado)** | `src/lib/admin-auth.ts`: leituras authz `User/Tenant` em contextos RLS explícitos; `/api/produtos` deixou de falhar por tenant-status invisível. |
| TypeScript | **PASS** | `tsc --noEmit` |

## Bloqueios críticos / lacunas
| Área | Estado |
|---|---|
| PrismaAdapter/OAuth/callbacks/account/session persistence sob RLS/pooling | **NOT PROVEN / AT RISK** |
| Register/verify/resend/change-email/forgot/reset/session-refresh/onboarding HTTP | **NOT EXECUTED** |
| Matriz completa admin HTTP (normal/company admin/plataforma/ADMIN/SUPERADMIN, prova/aprovação, planos, utilizadores, endpoints, manipulação tenantId) | **NOT EXECUTED** |
| Ciclo financeiro HTTP completo (draft→issue→PDF→pagamento parcial/total→histórico/saldos/relatórios/cancel/estorno; proteção PDF) | **NOT EXECUTED** |
| WMS HTTP completo (entradas/saídas/ajustes/transferências/PO/receção/reversões/idempotência/histórico/relatórios/FK compostas) | **NOT EXECUTED** |
| Auditoria Prisma exaustiva por call-path (heurística 70 SAFE/25 NEEDS CONTEXT/25 RISK/2 SYSTEM ONLY/7 ADMIN ONLY) | **PARTIAL** |
| Schema drift completo 51 modelos (colunas/tipos/índices/FKs/constraints/RLS OFF enumeration) | **NOT PROVEN** |
| Supabase/PgBouncer transaction pooling (sessão-local GUC risk) | **NOT EXECUTED** (fora do âmbito local) |
| `_prisma_migrations` ausente em 5437 / divergência 5436/prod | **AT RISK / NOT RESOLVED** |
| `PROD-A-SYNTH` mismatch 5436 | **PENDENTE** (sem apply) |

## Critérios (resumo)
- RLS ativo nas tabelas abrangidas: **PASS parcial (5437)**.
- Role app sem BYPASSRLS: **PASS local**; produção não alterada.
- Isolamento PostgreSQL real: **PASS**.
- Sem acesso cruzado (subset testado): **PASS**.
- INSERT/UPDATE WITH CHECK: **PASS (subset DB)**.
- Operações admin/cron controladas: **PARCIAL**.
- Sem regressões funcionais: **PARCIAL** (provas limitadas).

## Autorização necessária antes de produção
Aprovação explícita + alvo Supabase + janela + responsável + SQL/plano aprovado + backup/snapshot + validação pós-mudança + E2E/pooling aprovados. Sem isso: **nenhuma alteração em produção**.
