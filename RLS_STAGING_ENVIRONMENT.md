# RLS_STAGING_ENVIRONMENT.md — local independent test environment
Data: 2026-11-05. Produção Supabase **intocada** (sem roles/GRANT/REVOKE/ALTER ROLE/migrations de segurança em produção, sem credenciais produção usadas para grants).

## Infraestrutura preparada
| Item | Valor |
|---|---|
| Host | `127.0.0.1` (local) |
| PostgreSQL | Docker `postgres:17` via `docker-compose.test.yml` |
| Container | `machine-stock-test-pg` (porta host **5437**→5432) — independente do WMS staging 5436 |
| Base de teste | `mf_rls_staging` (criada; **não** modifica `wms_staging` 5436) |
| Migrations Prisma | `prisma migrate deploy` aplicado com `DATABASE_URL/DIRECT_URL` apontando a `mf_rls_staging` (schema alinhado) |
| Pooling/PgBouncer | Direto a Postgres local (sem PgBouncer). `.env.staging` de produção referencia Supabase pooler 6543 — **não usado**. GUCs usam `set_config(..., true)` (LOCAL à transação) — compatível com transaction pooling se cada request usar 1 transação; validar em staging Supabase dedicado antes de produção. |

## WMS staging existente (5436, `wms_staging`) — inspecionado, não modificado
- `staging_admin` tem SUPERUSER/BYPASSRLS; DBs incluem `wms_staging`, `wms_rls_test`, `wms_staging_restore_test`.
- RLS já ativo em várias tabelas (`Customer,Product,Invoice,Payment,Supplier,Warehouse,StockMovement,BusinessDocument,Tenant,User,...`); políticas existentes usam `app.tenant_id` mas muitas sem `WITH CHECK` e sem `app.is_admin`/InvoiceItem/AdUnlock/special cases completos. **Nenhuma alteração aplicada em 5436.**

## Artefactos criados
- `scripts/rls-staging-roles.sql` (aplicado em `mf_rls_staging` local)
- `RLS_POLICIES_STAGING.sql` (aplicado em `mf_rls_staging` local)
- `scripts/rls-staging-two-tenant-test.cjs` + evidência gerada
- `tmp/apply-rls-roles.js`, `tmp/apply-rls-policies.js` (harness local)

## Credenciais
Usadas apenas credenciais locais do container de teste (`postgres`/senha local de compose). **Nenhuma credencial de produção Supabase usada.**
