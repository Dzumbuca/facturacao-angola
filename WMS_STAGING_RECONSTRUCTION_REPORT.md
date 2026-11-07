# WMS Staging Reconstruction Report

**Projeto:** facturacao-angola (Machine Facturas)
**Data:** 2026-11-03

## 1. Artefactos encontrados

Todos os artefactos em `C:\Users\ADMINI~1\AppData\Local\Temp\kilo\wms_arch_v2\` presentes e íntegros:
- `schema.v2.prisma`, `migration.v2.sql`, `MULTITENANT_SECURITY_DESIGN.md`, `MIGRATION_PLAN.md`, `WMS_ARCH_V2_CHANGELOG.md`, `COMPATIBILITY_REPORT.md`, `STAGING_VALIDATION_PLAN.md`, `STOCK_MIGRATION_PLAN.md`, etc.

## 2. Integridade da migration

- `migration.v2.sql` aplicada com sucesso sobre o schema base (24 migrations Prisma aplicadas previamente).
- Tabelas criadas: 52 (schema public).
- Roles Supabase (`anon`, `authenticated`, `service_role`) criadas para compatibilidade com migrations.

## 3. Container criado

- Nome: `machine-wms-staging`
- Imagem: `postgres:18` (PostgreSQL 18.6 confirmada)
- Porta: `127.0.0.1:5436` (5434 ocupada por `kyc_postgres`; 5436 documentada)
- Volume exclusivo: `machine-wms-staging-data` (mount `/var/lib/postgresql`)
- Database: `wms_staging`
- Utilizador admin: `staging_admin` (password em ficheiro local, não commitado)

## 4. Roles configuradas

- `staging_admin` (owner da database)
- `app_user` (NOSUPERUSER, NOBYPASSRLS, LOGIN) — aplicação
- `migration_user` (NOSUPERUSER, NOBYPASSRLS, LOGIN) — migrações
- `anon`, `authenticated`, `service_role` (compatibilidade Supabase)

## 5. Schema aplicado

- 24 migrations Prisma + `migration.v2.sql` aplicadas com sucesso.
- 52 tabelas no schema public.

## 6. Políticas RLS

- RLS FORCE aplicado nas tabelas WMS v2 (conforme migration).
- 7 tabelas identificadas sem RLS (BusinessDocument, BusinessDocumentCounter, EmailActionToken, EmailCampaign, EmailCampaignRecipient, EmailDelivery, PlatformTeamInvite) — pendente análise individual (Script D).

## 7. Dados sintéticos criados

**Pendente** — a criar na próxima etapa (Tenant A: stock 50/PWS 10; Tenant B: stock 30/sem PWS, cenários de reversão, ajustamentos, transferências, reservas, isolamento).

## 8. Testes executados

- Conexão PostgreSQL: OK
- Versão: PostgreSQL 18.6 confirmada
- Schema: 52 tabelas presentes
- Migration v2: aplicada sem erros

## 9. Problemas encontrados

- Porta 5434 (pretendida) ocupada por `kyc_postgres` → utilizado 5436 (documentado).
- `machine_stock_test` (volume anterior) contém schema antigo — não reutilizado.
- Staging original (18.6/5433/wms_staging) não recuperável — reconstruído do zero.

## 10. Próximos passos da Fase 3.1

1. Criar dados sintéticos (Tenant A/B, warehouses, products, PWS, movimentos).
2. Criar roles app_user/migration_user com RLS (já criados).
3. Executar backfills A/B/C/D (corrigidos) e validar idempotência.
4. Validar isolamento multi-tenant e consistência de stock.
5. Produzir `WMS_PHASE3_1_RECONCILIATION_REPORT.md`.

**Staging reconstruído: parcialmente** — schema e infraestrutura OK; dados sintéticos e validações pendentes.
Aguardando autorização para prosseguir com a criação de dados de teste e backfills.