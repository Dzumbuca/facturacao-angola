# Supabase Security Validation Report — Machine Facturas (preparação)

**Data:** 2026-11-05  
**Ambiente validado por acesso direto:** staging/local wms_staging@127.0.0.1:5436 (read-only para segurança; stress/harness prévios foram autorizados separadamente e usaram dados stress-* limpos).  
**Produção:** **não validada, não alterada.**

## Testes/validações executadas (staging/local + repositório)
| Área | Resultado | Evidência/nota |
|---|---|---|
| Auditoria SQL read-only: roles, RLS, FORCE, políticas, grants anon/auth, schema/funções/views | **Aprovado (coleta)** | Scripts pg_catalog/information_schema; achados em SUPABASE_SECURITY_AUDIT.md |
| prisma migrate status | **Aprovado** | 24 migrações, schema up to date no staging local |
| prisma migrate deploy (autorizado staging local) | **Sem pendentes** | “No pending migrations to apply” |
| WMS stress concorrência 20/50/100/200 (autorizado staging local) | **Aprovado** | 0 falhas; saldos Product/ProductWarehouseStock consistentes |
| Reconciliação stock dry-run (autorizado staging local) | **Aprovado com achado** | 1 mismatch sintético PROD-A-SYNTH (delta -40); sem correção aplicada |
| TypeScript 	sc --noEmit (repo) | **Aprovado** | execução anterior no contexto WMS |
| Build Next.js (repo) | **Aprovado** | execução anterior |
| Testes unitários stock/WMS rotas (repo) | **Aprovado** | 18/18 passaram (contexto anterior) |

## Testes de segurança/negócio obrigatórios — estado
| Teste | Estado | Observação |
|---|---|---|
| Login/logout NextAuth | **Pendente em staging representativo** | Não executado E2E nesta sessão de auditoria; staging local tem schema drift histórico vs produção possível |
| Google auth (se aplicável) | **Pendente** | Depende de configuração OAuth no ambiente |
| Registo de empresas / onboarding | **Pendente** | Validar com role app sem BYPASSRLS + RLS/FORCE |
| CRUD clientes, produtos, serviços | **Pendente** | Cobrir com 2+ tenants |
| Emissão faturas / documentos venda | **Pendente** | Fluxo crítico; inclui AdUnlock, transações, raw SQL |
| Stock/armazéns (operacional E2E HTTP) | **Parcial** | Stress DB OK; testes 	ests/e2e/wms/* fora do include vitest e dependem de infra |
| Pagamentos/financeiro | **Pendente** | Payment/PaymentReceipt sem política no staging observado |
| Relatórios | **Pendente** | Algumas rotas usam Prisma direto; validar contexto tenant |
| Operações admin | **Pendente** | dmin-data usa Prisma direto; políticas globais/admin a validar |
| Isolamento 2+ tenants (tentativas cross-tenant) | **Pendente** | Teste obrigatório antes de produção |
| Sessões existentes após mudança de privilégios/RLS | **Pendente** | Especialmente NextAuth tables (Account/Session/VerificationToken) |

## Correções realizadas
- **Produção:** nenhuma (conforme autorização/limites).
- **Staging/local:** nenhum endurecimento RLS/roles aplicado nesta auditoria; apenas inspeções read-only e validações WMS previamente autorizadas. AdUnlock e tabelas plataforma permanecem sem RLS no staging observado — **não corrigido** para evitar alterar estado sem plano aprovado.

## Riscos residuais (principais)
1. **Produção desconhecida:** estado real de roles/grants/RLS/policies/owners pode divergir do staging e do advisor.
2. **Role app com BYPASSRLS em produção (reportado):** remover sem FORCE RLS+políticas+grants+testes quebra funcionalidade; manter expõe dados se Data API/roles mal configuradas.
3. **NextAuth tables com RLS/sem política (staging):** aplicar FORCE RLS/políticas incorretas pode quebrar autenticação.
4. **InvoiceItem sem 	enantId:** requer política por relação com Invoice; risco de vazamento ou de bloqueio.
5. **Código com Prisma direto fora de unWithTenant:** pode falhar ou contornar design se contexto/políticas mudarem.
6. **Tabelas globais/admin:** políticas tenant genéricas podem bloquear operações legítimas.

## Decisão
**PRONTO PARA REVISÃO** (documentação/plano/SQL de rascunho). **NÃO PRONTO PARA PRODUÇÃO** até preencher checklist de execução, confirmar alvo real, aprovar SQL adaptado, e passar testes obrigatórios em staging representativo.
