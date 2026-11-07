# Supabase RLS Implementation Plan — Machine Facturas (preparação)

**Estado:** plano preparado; **não aplicado em produção**. Baseado em código + staging/local read-only (2026-11-05).

## Objetivos
- Isolamento estrito por 	enantId para dados de negócio (clientes, produtos, faturas, pagamentos, stock, relatórios, documentos).
- Bloquear acesso Data API non/authenticated a dados sensíveis.
- Remover dependência de BYPASSRLS/superuser na role da aplicação (em janela autorizada).
- Manter Prisma/NextAuth funcionais: unWithTenant define pp.tenant_id, pp.user_id, pp.is_admin por transação (set_config(..., true)).

## Abordagem recomendada (compatível com arquitetura atual)
1. **Defesa em profundidade:** REVOKE/sem grants para non/authenticated + RLS enabled em todas as tabelas public.
2. **RLS + FORCE RLS** nas tabelas de dados; owners bypass podem ignorar RLS sem FORCE — ajustar apenas com owner/role corretos e testes.
3. **Políticas por tabela/operação:**
   - Tenant-scoped com 	enantId: USING (current_setting('app.tenant_id', true) = "tenantId"::text) **e** WITH CHECK (...) para INSERT/UPDATE.
   - Tenant: comparar com id.
   - User: tratar 	enantId IS NULL com cuidado (onboarding/plataforma) — validar fluxos reais.
   - InvoiceItem (sem 	enantId): política via EXISTS no parent Invoice com mesmo tenant; exige índice/FK e teste de performance/correção.
   - BusinessDocumentItem tem 	enantId; BusinessDocumentEvent/PaymentEvent têm 	enantId — aplicar padrão tenant.
   - Tabelas globais/admin (PlatformApplication, SubscriptionPlan, PlanApplication, PlatformConfig, AdminAuditLog, campanhas, convites): **não** usar tenant policy cega; usar políticas restritivas (admin context pp.is_admin='true' onde aplicável) ou acesso apenas por role de serviço/app controlada no servidor — validar cada caso.
   - Account, Session, VerificationToken (NextAuth/Prisma Adapter): tabelas sensíveis; acesso normalmente server-side pela app. Se RLS/FORCE aplicados, garantir role app/políticas permitem operações do adapter ou usar role/mecanismo controlado. **Risco alto de quebrar login** se mal aplicado.
   - _prisma_migrations: nunca expor; acesso apenas migração/admin.
4. **Roles separadas:** migração/DDL vs app runtime; eliminar BYPASSRLS da app apenas após FORCE RLS+políticas+grants+testes.
5. **GUCs:** unWithTenant usa is_local=true (transação) — correto. Garantir que **todas** as operações sensíveis usam unWithTenant ou contexto equivalente; queries fora de transação com set_config(...,true) não propagam como esperado.

## Gaps observados em staging (a corrigir no plano)
| Categoria | Tabelas/observação |
|---|---|
| Sem RLS | AdUnlock, PlanApplication, PlatformApplication, SubscriptionPlan, TenantApplication, TenantSubscription |
| RLS sem políticas (default-deny) | 18 tabelas: Account, AdminAuditLog, BusinessDocumentEvent, BusinessDocumentItem, CompanyBankAccount, CompanyLogo, EmailRequestLimit, InvoiceDraft, InvoiceItem, MarketingPreference, Payment, PaymentEvent, PaymentReceipt, PlanPayment, PlatformConfig, Session, VerificationToken, _prisma_migrations |
| Sem FORCE RLS (staging) | mesmas 18 acima + outras com owner bypass; produção pode variar |
| Sem WITH CHECK (amostra staging) | várias políticas tenant (Customer, Invoice, Product, WMS, Tenant, User etc.) |
| Child sem tenantId | InvoiceItem — requer política por Invoice.tenantId |
| App sem contexto uniforme | rotas/serviços usando Prisma direto (d-unlock-service raw SQL, admin-data, auth/onboarding/company-profile/desktop-bootstrap/stock reports, etc.) — validar compatibilidade |

## Ordem de execução (produção, quando autorizado)
1. **A. Preparação:** backup/snapshot, acesso admin, identificar role Prisma real (current_user da app), owners, estado RLS/grants/policies; dry-run em staging representativo.
2. **B. Roles:** criar/ajustar role migração e role app (sem super/bypass), connection strings separadas; **não** remover BYPASSRLS antes de C–H.
3. **C. Privilégios:** revogar anon/authenticated em schema/tabelas/seq/funções/defaults; garantir grants mínimos da role app; validar service_role.
4. **D. RLS/políticas:** enable RLS onde faltar; criar políticas explícitas (WITH CHECK) por tabela/operação; tratar NextAuth tables e globais com casos especiais.
5. **E. Ownership/FORCE RLS:** aplicar FORCE ROW LEVEL SECURITY após políticas/grants testados; considerar owner role dedicada (não superuser).
6. **F. Funções/views/sequences:** revisar SECURITY DEFINER, execute, search_path; revogar execuções públicas.
7. **G. Prisma:** validar adapter NextAuth, transações unWithTenant, raw SQL, bulk ops, rotas sem runWithTenant.
8. **H. Isolamento:** testes cross-tenant (2+ tenants), leitura/escrita, admin, billing, stock, documentos.
9. **I. Rollback:** scripts/decisão por etapa; restaurar snapshot se critério de paragem atingido.

## Critérios de paragem
- Falha de login/sessão NextAuth.
- Erros de autorização bloqueando faturação/operações críticas.
- Vazamento cross-tenant detectado (oposto: parar e investigar).
- Impossibilidade de validar acesso admin/DDL necessário para rollback.

## Nota sobre scripts SQL preparados
SUPABASE_PRODUCTION_MIGRATION.sql e SUPABASE_ROLLBACK_PLAN.sql são **rascunhos de preparação** com preflights e TODOs dependentes do alvo real. **Não executar cegamente em produção.** Revisão obrigatória pelo responsável com acesso ao projeto Supabase alvo.
