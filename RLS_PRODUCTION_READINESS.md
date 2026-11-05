# RLS_PRODUCTION_READINESS.md
## Estado
**NÃO PRONTO PARA PRODUÇÃO.** Isolamento multi-tenant e integração mínima de executores RLS demonstrados **apenas** em DB PostgreSQL local independente (`mf_rls_staging`, 5437) com roles NOBYPASSRLS. Produção Supabase **não foi alterada**. WMS staging `5436/wms_staging` **não foi alterado**. Nenhuma migration em produção, nenhum `prisma migrate reset`, nenhum dado removido.

## Evidência positiva (real, 5437)
- **Cobertura DB:** 51 modelos Prisma presentes (`dbOnly=0`). 47 relações RLS ON com 1 policy cada (USING/WITH CHECK nas tenant-scoped); 4 tabelas auth adapter RLS OFF por protótipo (`Account/Session/VerificationToken/EmailActionToken`). Sem tabela RLS-enabled com zero políticas.
- **Isolamento SQL (PG17+RLS+NOBYPASSRLS):** `rls-staging-two-tenant-test.cjs` **19/19 PASS**; `rls-priority-tables-test.cjs` **60/60 PASS**; `rls-executor-integration-test.cjs` **5/5 PASS** (EmailRequestLimit admin-only, self-user lookup por `app.user_id`, email lookup bloqueado sem contexto admin, missing tenant context -> zero invoices).
- **Integração código (mínima, segura):** `tenant-db` ganhou `runWithRlsContext/runAsAdmin/runAsAuth/runAsSystem` com GUCs transaction-local. Rotas/serviços alvo: session refresh, onboarding, auth register/forgot/resend/change-unverified-email, email-actions (rate limit/tokens/audit/delivery/unsubscribe), plan payment proof (server auth + admin executor), cron reminders (CRON_SECRET + system executor), NextAuth credentials/session lookups com contexto explícito. **PrismaAdapter permanece global** (protótipo compatível; não provado sob RLS).
- **Validações:** `npx tsc --noEmit` **PASS**. `vitest src/app/api/stock/route.test.ts` **4/4 PASS**. Regressões RLS 19/19, 60/60, 5/5 **PASS** após fixes. Build completo / suite completa / HTTP E2E **NOT EXECUTED**.

## Bloqueios para produção
1. **HTTP E2E NÃO EXECUTADO** contra app isolada em 5437+NOBYPASSRLS: auth/login/register/OAuth/verify/reset, onboarding, sessões, isolamento tenant A/B por API, admin, facturas/PDF/pagamentos/comprovativos, clientes/fornecedores, stock/WMS.
2. **NextAuth/PrismaAdapter não validado** sob RLS enforcement; tabelas adapter RLS-off são apenas protótipo.
3. **Admin runtime incompleto:** `admin-actions.ts`/dashboards/plataforma não totalmente migrados/validados com executor admin.
4. **Pooling/PgBouncer Supabase não validado** (GUC transaction-local ok em princípio, sem prova em ambiente autorizado equivalente).
5. **Schema/migration integrity:** anomalia `_prisma_migrations` ausente em 5437; drift Prisma schema vs 5437 (subset aditivo). 5436 tem políticas/WMS divergentes (não modificado).
6. **5436 `PROD-A-SYNTH`** mismatch pendente decisão; sem `--apply`.

## Critérios
| Critério | Estado |
|---|---|
| RLS ativo nas tabelas abrangidas | **PASS parcial** (5437; subset completo em SQL/cobertura) |
| Role app sem BYPASSRLS | **PASS local** (5437); produção não alterada |
| Testes isolamento PostgreSQL real | **PASS** (19/19, 60/60, 5/5) |
| Sem acesso cruzado entre tenants (DB) | **PASS no subset testado** |
| INSERT/UPDATE respeitam WITH CHECK | **PASS no subset testado** |
| Operações admin/cron controladas | **PARCIAL** (código alvo + evidência DB; runtime HTTP/E2E pendente) |
| Sem regressões funcionais | **PARCIAL** (TS + subset tests ok; build/suite/E2E pendentes) |

## Autorização necessária antes de produção
Aprovação explícita + alvo Supabase + janela + responsável + SQL/plano aprovado + backup/snapshot + validação pós-mudança + E2E/pooling aprovados. Sem isso: **nenhuma alteração em produção**.
