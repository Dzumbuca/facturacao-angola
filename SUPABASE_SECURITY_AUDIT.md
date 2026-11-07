# Supabase Security Audit — Machine Facturas (preparação, sem alterações em produção)

**Data da auditoria (leitura/análise):** 2026-11-05  
**Âmbito auditado diretamente:** repositório local + base **staging/local autorizada** wms_staging@127.0.0.1:5436 (credenciais não expostas).  
**Produção Supabase:** **NÃO auditada por acesso direto** neste trabalho e **NÃO modificada**. O Security Advisor citado pelo pedido (26 tabelas públicas com RLS desativado, privilégios excessivos anon/authenticated, role Prisma com BYPASSRLS) deve ser tratado como **vulnerabilidade reportada a confirmar no alvo de produção**.

## 1) Contexto técnico (confirmado no código)
- **Stack:** Next.js 16, Prisma ORM 5.22, PostgreSQL/Supabase, NextAuth JWT (src/lib/auth.ts, session.strategy='jwt').
- **Sem Supabase Auth direto na app:** autenticação gerida por NextAuth/Credentials + Google OAuth opcional.
- **Multi-tenant:** 	enantId em sessão/JWT; helper unWithTenant (src/lib/tenant-db.ts) define por transação set_config('app.tenant_id', ..., true), pp.user_id, pp.is_admin e executa queries dentro de prisma..
- **Prisma:** PrismaClient simples (src/lib/prisma.ts), datasource usa DATABASE_URL (prisma/schema.prisma).

## 2) Evidência de base de dados (staging/local, read-only)
- **DB/role efetiva:** wms_staging, current_user=session_user=staging_admin, PostgreSQL 18.6; staging_admin **rolsuper=true, rolbypassrls=true, rolcanlogin=true** (superuser/bypass — típico de admin local, **não aceitável como role de app em produção**).
- **Roles API Supabase presentes:** non, uthenticated, service_role (sem login/super/bypass). **Grants de tabela/coluna/sequência para anon/authenticated no schema public: 0** (staging). USAGE schema public: anon/auth **false**, service_role/current **true**. Funções públicas executáveis por anon/auth: **0**. Views/matviews em public: **0**. SECURITY DEFINER em public: **0**.
- **Tabelas public: 52** (inclui _prisma_migrations), todas com owner staging_admin.
- **RLS desativado (6):** AdUnlock, PlanApplication, PlatformApplication, SubscriptionPlan, TenantApplication, TenantSubscription.
- **RLS ativado mas SEM políticas (18, default-deny na prática, risco operacional/ambíguo):** Account, AdminAuditLog, BusinessDocumentEvent, BusinessDocumentItem, CompanyBankAccount, CompanyLogo, EmailRequestLimit, InvoiceDraft, InvoiceItem, MarketingPreference, Payment, PaymentEvent, PaymentReceipt, PlanPayment, PlatformConfig, Session, VerificationToken, _prisma_migrations.
- **RLS ativado SEM FORCE ROW LEVEL SECURITY (18, mesmo conjunto acima):** owners/superuser/BYPASSRLS contornam RLS quando FORCE não está ativo.
- **Políticas existentes (28 tabelas, 1 política cada, permissiva, TO public/roles default, cmd ALL):** maioritariamente current_setting('app.tenant_id', true) = "tenantId". Exceções: Tenant compara com id; User permite 	enantId IS NULL; EmailActionToken usa pp.user_id; EmailCampaign/EmailCampaignRecipient/PlatformTeamInvite usam pp.is_admin='true'; EmailDelivery permite 	enantId IS NULL OR tenantId=app.tenant_id.
- **Políticas sem WITH CHECK (apenas USING) em várias tabelas tenant-scoped** (ex.: Customer, Invoice, Product, stock/WMS, Tenant, User, etc.) — USING não impede INSERT/UPDATE com 	enantId incorreto; requer WITH CHECK explícito.
- **Riscos de expressão de política:** pp.tenant_id é 	ext via current_setting(..., true); comparar com colunas uuid/	ext conforme tipo real exige cuidado. InvoiceItem **não tem 	enantId** no Prisma/schema — políticas por join/parent necessárias (ou coluna denormalizada). BusinessDocumentItem tem 	enantId; BusinessDocumentEvent/PaymentEvent têm 	enantId.
- **Default privileges (staging):** staging_admin retém EXECUTE default em funções para si (schema public/global conforme query); **nenhum default privilege para anon/authenticated** encontrado nas queries de staging.
- **Colunas sensíveis (schema):** Account.access_token/refresh_token, Tenant.iban, CompanyBankAccount.iban, User.password, VerificationToken.token. RLS/políticas + ausência de grants a anon/auth mitigam exposição via Data API; app controla acesso.

## 3) Migrações/scripts relevantes no repositório
- prisma/migrations/20261027180000_public_api_security/migration.sql: ativa RLS em tabelas existentes, revoga grants de PUBLIC/anon/authenticated (tables/sequences/functions/schema), ajusta default privileges para o role executor, preserva service_role/role Prisma. **Ponto crítico:** executado pelo role de migração (current_user) — em Supabase produção o efeito depende de quem executa migrations e do estado atual.
- prisma/app-user-role.sql: cria pp_user NOLOGIN NOSUPERUSER NOBYPASSRLS, grants em public; **assume FOR ROLE postgres** nos default privileges — **não portátil** para Supabase (owner/migration role pode diferir).
- prisma/rls-machine-platform.sql, prisma/rls-machine-stock.sql, scripts/backfill_D_rls.sql: coberturas parciais; **nem todas aplicam FORCE RLS nem cobrem todas as tabelas**; algumas usam FOR ALL com USING/WITH CHECK corretos, outras variantes existem nas migrações/estado real.
- Tabelas WMS mais recentes criadas após migração public_api_security podem ter RLS ativado por migrações posteriores, mas o risco de **futuras tabelas sem grants/defaults adequados** depende do processo de migration em produção.

## 4) Uso Prisma / dependências que podem quebrar
- **unWithTenant** já define pp.tenant_id/user_id/is_admin por transação (set_config(..., true) = local à transação) — compatível com políticas baseadas nessas GUCs, **desde que** as queries passem por esse contexto e as políticas/grants permitam.
- **Queries Prisma diretas (sem unWithTenant)** existem (heurística): rotas como uth/*, company-profile, onboarding, customers, produtos, invoices/drafts, stock/reports, desktop/offline-bootstrap, cron/reminders, session/refresh, etc., e serviços/libs (d-unlock-service usa SQL raw em AdUnlock; dmin-data, invoice-service, usiness-document-repository, etc.). **Risco:** se RLS for endurecido com FORCE e a role da app **não** tiver BYPASSRLS nem pp.tenant_id definido (ou política não cobrir o caso), operações legítimas falham.
- **AdUnlock** usa SQL raw parametrizado ($executeRaw/), operações por 	enant_id; tabela sem RLS no staging — corrigir exige política + garantir role/contexto compatível com fluxo transacional de emissão.
- **Admin/plataforma:** algumas tabelas globais (Platform*, SubscriptionPlan, PlanApplication, AdminAuditLog, PlatformConfig, etc.) não seguem 	enantId simples; políticas devem distinguir admin/plataforma vs tenant ou usar funções/claims controladas — **não impor padrão tenant genérico sem validar**.

## 5) Vulnerabilidades confirmadas (staging) / a confirmar (produção)
| ID | Achado | Severidade | Estado staging | Produção |
|---|---|---:|---|---|
| V1 | Role de app/superuser com **BYPASSRLS/SUPERUSER** (staging_admin) | Crítica | Confirmado (ambiente local) | **A confirmar** (advisor indicou role Prisma com BYPASSRLS) |
| V2 | Tabelas **sem RLS** (AdUnlock, PlanApplication, PlatformApplication, SubscriptionPlan, TenantApplication, TenantSubscription) | Alta/Crítica | Confirmado | **A confirmar** |
| V3 | RLS **sem políticas** (18 tabelas) — default-deny + risco operacional; _prisma_migrations sensível | Alta | Confirmado | **A confirmar** |
| V4 | Falta **FORCE RLS** em 18 tabelas + owner superuser/bypass | Alta | Confirmado | **A confirmar** |
| V5 | Políticas tenant sem **WITH CHECK** / cobertura incompleta de INSERT-UPDATE-DELETE | Média/Alta | Confirmado (amostra) | **A confirmar** |
| V6 | InvoiceItem sem 	enantId — isolamento depende de join/política parent | Média/Alta | Confirmado no schema | Confirmado no schema; política DB a confirmar |
| V7 | non/authenticated com privilégios excessivos | Crítica (potencial Data API) | **Não observado em staging** (0 grants) | **A confirmar** |
| V8 | Default privileges futuros podem reabrir acesso conforme role executor | Média | Parcialmente mitigado em staging | **A confirmar** |
| V9 | Views/triggers/SECURITY DEFINER bypass | Variável | Não encontrados em public (staging) | **A confirmar** |

## 6) Limitações desta auditoria
- Sem acesso ao **projeto Supabase de produção**; sem confirmação de current_user Prisma em produção, grants reais, políticas reais, owners reais, extensões, storage/auth schemas, ou uso de Data API/PostgREST.
- prisma migrate status/queries foram executadas apenas em staging/local autorizado.
- Não foram executados testes E2E completos multi-tenant em staging além dos já validados no contexto WMS (stress unitário/DB local); regressão funcional ampla **pendente**.
- Contagens/tabelas do advisor (26) podem diferir do estado atual; divergência deve ser reconciliada em produção.

## 7) Decisão técnica
**NÃO PRONTO PARA PRODUÇÃO.** Auditoria e preparação concluídas com evidência de staging/código; **falta** identificação do alvo de produção, janela, responsável, validação de pré-requisitos, confirmação do estado real em produção, revisão/aprovação do SQL por quem executa, e testes de regressão/isolamento em staging representativo. Produção **permanece intocada**.
