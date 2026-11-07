# Phase 1H — Relatório Final de Evidências (Machine Facturas)

**Branch:** `wms-v2-e2e-staging`  
**Commit:** `95e00366`  
**Container alvo (Docker):** `machine-stock-test-pg` (`bfcfaa2bd17a`, `postgres:17`, `5437->5432`)  
**Base alvo:** `mf_rls_staging` (existência/identidade **NOT PROVEN** sem ligação autenticada)  
**Método:** Exclusivamente estático. Sem SQL executado, sem ligações, sem alterações, sem segredos, sem testes de exploração, sem commits.  
**Decisão anterior:** NO-GO  
**Estado final:** **NO-GO** (mantido) — auditoria não considerada completa para declaração de segurança

## A) Matriz das 60 API Routes (estado de análise)

Foram identificados **60** ficheiros `route.ts` em `src/app/api/`. Dos 60, **~10 analisados integralmente**, **~10 parcialmente**, **40+ apenas inventariados**.

| # | Rota | Métodos | Autenticação | Origem `tenantId` | Helper/Prisma | Estado | Classificação |
|---|---|---|---|---|---|---|---|
| 1 | `ads/unlock/begin/route.ts` | POST | `getTenantWriteAccess()` | Guards (`access.access.tenantId`) | `beginAdWatch` (usa `ad-unlock-service` com GUCs manuais) | Parcial | AUTORIZAÇÃO NÃO PROVADA |
| 2 | `ads/unlock/complete/route.ts` | POST (presumido) | Provável guards | Guards (provável) | `completeAdWatch` | Inventariado | NÃO PROVADO |
| 3 | `auth/[...nextauth]/route.ts` | GET/POST | Delegado NextAuth | Delegado | Adapter embrulhado | Inventariado | NÃO PROVADO |
| 4 | `auth/change-unverified-email/route.ts` | POST | Provável sessão | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 5 | `auth/forgot-password/route.ts` | POST | Público | N/A | Provável `runAsSystem` | Inventariado | NÃO PROVADO |
| 6 | `auth/register/route.ts` | POST | Público (rate-limited) | Criado novo `Tenant` via `runAsSystem` | `runAsSystem` (transação) | **Integral** | RISCO POTENCIAL |
| 7 | `auth/resend-verification/route.ts` | POST | Provável | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 8 | `auth/reset-password/route.ts` | POST | Público | A determinar | Provável `runAsSystem` | Inventariado | NÃO PROVADO |
| 9 | `auth/verify-email/route.ts` | POST | Público | A determinar | Provável `runAsSystem` | Inventariado | NÃO PROVADO |
| 10 | `business-documents/[id]/convert-to-invoice/route.ts` | POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 11 | `business-documents/[id]/pdf/route.ts` | GET | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 12 | `business-documents/[id]/status/route.ts` | PUT/PATCH | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 13 | `business-documents/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 14 | `business-documents/route.ts` | GET/POST | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 15 | `company-profile/bank-accounts/[id]/route.ts` | PUT/PATCH/DELETE | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 16 | `company-profile/bank-accounts/route.ts` | GET/POST | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 17 | `company-profile/route.ts` | GET/PUT | Provável tenant | Via tenant context | `runWithTenant` | Parcial | AUTORIZAÇÃO NÃO PROVADA |
| 18 | `cron/reminders/route.ts` | GET | `CRON_SECRET` Bearer | Cross-tenant (Invoice.tenant) | `runAsSystem` | **Integral** | AUTORIZAÇÃO NÃO PROVADA |
| 19 | `customers/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 20 | `customers/route.ts` | GET/POST | Provável tenant | Obtido pela rota | `runWithTenant` + filtro `tenantId` + `{userId}` | Parcial | AUTORIZAÇÃO NÃO PROVADA |
| 21 | `desktop/offline-bootstrap/route.ts` | GET/POST | A determinar | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 22 | `email/unsubscribe/route.ts` | GET/POST | Baseado em token | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 23 | `ferramentas/documento-pdf/route.ts` | POST | A determinar | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 24 | `invoices/drafts/[id]/issue/route.ts` | POST | `getTenantWriteAccess()` | Guards | `getInvoiceQuota` + `issueInvoiceDraft` + `runWithTenant` | **Integral** | AUTORIZAÇÃO NÃO PROVADA |
| 25 | `invoices/drafts/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 26 | `invoices/drafts/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 27 | `invoices/generate-pdf/route.ts` | POST | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 28 | `invoices/generate-saft/route.ts` | POST | Provável tenant/admin | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 29 | `invoices/[id]/email/route.ts` | POST | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 30 | `invoices/[id]/payments/route.ts` | GET/POST | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 31 | `invoices/[id]/pdf/route.ts` | GET | `getTenantReadAccess()` | Guards | `runWithTenant` + `where:{id,tenantId}` + `{userId}` | **Integral** | SEGURA (design inspeccionado) |
| 32 | `onboarding/company/route.ts` | POST/PUT | Provável sessão | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 33 | `payments/[id]/status/route.ts` | GET/PUT | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 34 | `plan/payment/proof/[id]/route.ts` | GET/POST | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 35 | `plan/payment/route.ts` | GET/POST | Provável tenant | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 36 | `produtos/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 37 | `produtos/route.ts` | GET/POST | Provável tenant | Obtido pela rota | `runWithTenant` + filtro `tenantId` + `{userId}` | Parcial | AUTORIZAÇÃO NÃO PROVADA |
| 38 | `reports/export/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 39 | `session/refresh/route.ts` | POST | Cookie JWT | Lido da BD via `runWithRlsContext(userId do token, isAdmin:false)` | `runWithRlsContext` | **Integral** | SEGURA (design inspeccionado) |
| 40 | `stock/adjustments/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 41 | `stock/alerts/route.ts` | GET | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 42 | `stock/balances/route.ts` | GET | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 43 | `stock/lots/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 44 | `stock/movements/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 45 | `stock/movements/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 46 | `stock/purchase/orders/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 47 | `stock/purchase/receptions/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 48 | `stock/purchase/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 49 | `stock/report/route.ts` | GET | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 50 | `stock/reports/route.ts` | GET | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 51 | `stock/reservations/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 52 | `stock/reservations/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 53 | `stock/returns/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 54 | `stock/transfers/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 55 | `stock/transfers/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 56 | `stock/warehouses/[id]/route.ts` | GET/PUT/PATCH/DELETE | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 57 | `stock/warehouses/route.ts` | GET/POST | Provável tenant | A determinar | Provável `runWithTenant` | Inventariado | NÃO PROVADO |
| 58 | `stock/route.ts` | GET/HEAD | `auth()` + sessão | `getSessionTenantId(session)` | `runWithTenant(...,{userId,isAdmin:false})` com filtro `tenantId` | **Integral** | AUTORIZAÇÃO NÃO PROVADA |
| 59 | `team-invites/accept/route.ts` | POST | A determinar | A determinar | A determinar | Inventariado | NÃO PROVADO |
| 60 | `team-invites/preview/route.ts` | GET | A determinar | A determinar | A determinar | Inventariado | NÃO PROVADO |

**Cobertura real:** ~12-15 rotas integralmente analisadas, ~5 parcialmente, restantes inventariadas apenas. **Cobertura efetiva: ~25-30%** (inferior ao estimado anteriormente).

## B) Server Actions

**Pesquisa:** `Select-String -Pattern '^\s*"use server"'` em `src/**/*.ts,*.tsx` → **0 resultados ao nível de ficheiro**. Pesquisa por ficheiros com `server` no nome → apenas `src/utils/supabase/server.ts`. Inspeção não revelou `"use server"` inline concluinte.  
**Resultado:** **Não foram identificados Server Actions com diretiva `"use server"` neste repositório** no âmbito verificado. Comandos/padrões pesquisados documentados; conclusão limitada ao âmbito efetivamente verificado.

## C) Operações administrativas

| Componente | Função | Validação | Estado |
|---|---|---|---|
| `src/lib/admin-auth-core.ts` | `requirePlatformAdmin`, `requirePlatformPermission`, `getPlatformMember`, `getTenantAccess`, `assertTenantWriteAllowed` | Usa `auth()`, `findUserById` com `runWithRlsContext(userId, tenantId:null, isAdmin:false)`, valida `status`, `platformRole`, `platformPermissions`, `tenantRole/status`. | **CONFIRMADO** |
| `src/lib/admin-auth.ts` | Wrappers sobre core | Usa `auth()` e `runWithRlsContext` para carregar user+tenant. | **CONFIRMADO** |
| `src/app/admin/**` | Páginas administrativas | Presumivelmente protegidas; **não verificado** se todas as ações obrigatoriamente passam pelos guards. | **NÃO PROVADO** |
| `src/lib/tenant-db.ts` | `runAsAdmin` | **Sem validação interna. 0 utilizações** encontradas. | **VULNERABILIDADE CONFIRMADA (design) / SEM USO** |
| `src/lib/tenant-db.ts` | `runAsSystem` | **Sem validação interna.** Utilizado em adapter/auth/email/cron/register. | **RISCO POTENCIAL** |

## D) Matriz de origem e validação do tenantId

| Fluxo | Origem | Comparação sessão/BD | Filtro tenantId | Classificação |
|---|---|---|---|---|
| `invoices/[id]/pdf` | Guards | Sim | Sim (`{id, tenantId}`) | SEGURA (design) |
| `ads/unlock/begin` | Guards | Sim (via guards) | Depende serviço | AUTORIZAÇÃO NÃO PROVADA |
| `invoices/drafts/[id]/issue` | Guards | Sim (via guards) | Tratado nos serviços com contexto tenant | AUTORIZAÇÃO NÃO PROVADA |
| `customers/route.ts` | Obtido pela rota | **Não demonstrado como exclusivamente sessão** | Sim nos queries via `runWithTenant` | AUTORIZAÇÃO NÃO PROVADA |
| `produtos/route.ts` | Obtido pela rota | **Não demonstrado como exclusivamente sessão** | Sim nos queries via `runWithTenant` | AUTORIZAÇÃO NÃO PROVADA |
| `stock/route.ts` | `getSessionTenantId(session)` | Derivado sessão; **validação da função não lida na íntegra** | Sim com `runWithTenant({userId,isAdmin:false})` | AUTORIZAÇÃO NÃO PROVADA |
| `session/refresh` | Lido BD com `userId` token | Revalida com `runWithRlsContext` | N/A | SEGURA (design) |
| `auth/register` | Criado novo | Público bootstrap | N/A | RISCO POTENCIAL |
| `cron/reminders` | De `Invoice.tenant` | Protegido por `CRON_SECRET` + `runAsSystem` | Sem filtro app por tenant (cross-tenant intencional) | AUTORIZAÇÃO NÃO PROVADA |

## E) Matriz de chamadores dos helpers RLS

| Chamador → Helper | Origem contexto | Operação Prisma | Classificação |
|---|---|---|---|
| `tenant-db.ts` (central) → `runWithRlsContext` | Parâmetro `context` (sem validação interna) | Qualquer passado via `fn(tx)` numa transação com `set_config(..., true)` | FRAGILIDADE DE DESENHO |
| `auth.ts:113-126` → `runWithRlsContext` | `isAdmin:true, userId:null, tenantId:null` (pré-autenticação) | `tx.user.findUnique` por email | RISCO POTENCIAL (intencional) |
| `auth.ts:159-170` → `runWithRlsContext` | `isAdmin:false, userId:token.sub, tenantId:null` | `tx.user.findUnique` por id | SEGURA (design) |
| `admin-auth.ts` → `runWithRlsContext` | `isAdmin:false` com `userId` e opcional `tenantId` | `tx.user.findUnique`, `tx.tenant.findUnique` | SEGURA (design) |
| `auth-prisma-adapter.ts` → `runAsSystem`/`runWithRlsContext` | Conforme método (bootstrap vs user) | Adapter Prisma embrulhado | RISCO POTENCIAL |
| `email-actions.ts` → `runAsSystem` | `isAdmin:true, userId:null, tenantId:null` | Múltiplas operações (transações) | RISCO POTENCIAL |
| `ad-unlock-service.ts` → `withTenantContext` (manual) | Define `app.tenant_id`, `app.user_id:'', app.is_admin:'false'` manualmente | `prisma` como executor com transação própria | RISCO POTENCIAL (inconsistente) |
| `invoice-service.ts` → `runWithTenant` | Derivado rota/serviço | Transação principal; pós-commit usa `linkUnlockToInvoice` com contexto separado | RISCO POTENCIAL |
| Rotas (customers/produtos/stock) → `runWithTenant` | `tenantId` obtido pela rota | Queries com filtro `tenantId` | AUTORIZAÇÃO NÃO PROVADA |

## F) Matriz das 47 políticas RLS e 4 tabelas sem RLS

**Fonte:** `RLS_POLICIES_STAGING.sql` + referências anteriores.

**Políticas com `app.is_admin`/`app.tenant_id`/`app.user_id`:**
- Tenant-scoped (base): `Customer,Product,Invoice,Payment,...,TenantSubscription` → `rls_tenant_isolation` (USING/WITH CHECK: admin OR `tenantId::text = app.tenant_id`)
- `InvoiceItem` → via `Invoice.tenantId`
- `AdUnlock` → `tenant_id` (snake_case)
- `Tenant` → `rls_tenant_self_or_admin`
- `EmailDelivery` → permite `tenantId IS NULL` ou tenant/admin
- `User` → admin OU `app.user_id = id` OU mesmo `tenantId`
- Admin-only: `AdminAuditLog,EmailCampaign,...,EmailRequestLimit` → `rls_admin_only` (só `app.is_admin='true'`)

**Tabelas de autenticação/NextAuth sem RLS ativado neste protótipo (conforme `RLS_POLICIES_STAGING.sql`):** `Account`, `Session`, `VerificationToken`, `EmailActionToken` (requerem auth executor isolado). **Classificadas como "SEM RLS ATIVADO" no âmbito inspecionado.**

**Cruzamento aplicação ↔ políticas:** 
- Helpers definem as GUCs esperadas. 
- `runAsSystem` com `app.is_admin='true'` bypassa efetivamente políticas baseadas em tenant/user (intencional para infra). 
- Divergências/inconsistências não verificáveis sem execução; correspondência **NÃO PROVADA** na totalidade.

## G) Descobertas com evidências exatas

| Descoberta | Classificação | Ficheiro:Linhas | Caminho de execução |
|---|---|---|---|
| `runAsAdmin` sem validação interna, 0 utilizações | Vulnerabilidade de design | `src/lib/tenant-db.ts:40-44` | Qualquer chamador → `runWithRlsContext({isAdmin:true,...})` sem guarda |
| `runWithTenant` permite `isAdmin:true` via contexto | Fragilidade de desenho | `src/lib/tenant-db.ts:28-38` | Rota/serviço → `runWithTenant(..., fn, {isAdmin:true})` |
| GUCs manuais em `ad-unlock-service` | Fragilidade de desenho | `src/lib/ad-unlock-service.ts:51-57` | `withTenantContext` → transação própria + `set_config` manual |
| Lookup pré-autenticação com `isAdmin:true` | Risco potencial | `src/lib/auth.ts:113-126` | `authorize()` → `runWithRlsContext` admin antes de validar password |
| Bootstrap com `runAsSystem` | Risco potencial | `src/app/api/auth/register/route.ts:36-76` | Público → `runAsSystem` transação cria Tenant/User |
| Cron cross-tenant com `runAsSystem` | Risco potencial | `src/app/api/cron/reminders/route.ts:1-120` | Header `CRON_SECRET` → `runAsSystem` lê/atualiza cross-tenant |
| Derivação `tenantId` possivelmente não exclusiva da sessão | Risco potencial | `src/app/api/customers/route.ts:1-50`, `src/app/api/produtos/route.ts:1-50`, `src/app/api/stock/route.ts:1-150` | Rota obtém `tenantId` (sessão/helper) mas comparação explícita não demonstrada em todas as rotas |
| Filtro tenant presente em rotas inspecionadas | Comportamento seguro confirmado (âmbito) | `src/app/api/invoices/[id]/pdf/route.ts:1-120`, `src/app/api/stock/route.ts:1-150` | Guards + `runWithTenant` + `where:{id, tenantId}` |

## H) Cobertura calculada (ficheiros efetivamente inspeccionados)

| Categoria | Total | Efetivamente inspecionados | % |
|---|---|---|---|
| `route.ts` | 60 | ~12-15 integralmente + ~10 parcialmente | **~25-30%** |
| Server Actions (`"use server"`) | 0 encontrados | 0 verificados | **0% comprovado** |
| Helpers RLS (`tenant-db`, `admin-auth*`, `auth*`) | 7 ficheiros-chave | 7 integralmente/parcialmente | **~90%** |
| Serviços críticos (`ad-unlock`, `invoice-service`, `email-actions`) | 3 | Parcialmente integral | **~60-70%** |
| Páginas/admin | Presentes | Parcial | **< 20%** |
| Políticas RLS | `RLS_POLICIES_STAGING.sql` + refs | Lido parcialmente + inventariado | **~40%** |

**COBERTURA GLOBAL REAL: ~30-35%** (significativamente abaixo de 100%).

## I) Lacunas ainda existentes
- [ ] **40+ route.ts** não lidos integralmente (métodos, body/query/params, validação, filtros, UPDATE/DELETE)
- [ ] **Server Actions** — pesquisa inconclusiva para padrões inline; requer varredura mais profunda
- [ ] **Todas as páginas/ações administrativas** — obrigatoriedade dos guards não demonstrada
- [ ] **Comparação sessão vs tenantId** em rotas que não usam `getTenant*Access` exclusivamente
- [ ] **Cruzamento completo com 47 políticas RLS** (mapeamento tabela→política→helper por caminho Prisma)
- [ ] **4 tabelas sem RLS** (`Account/Session/VerificationToken/EmailActionToken`) — impacto com fluxos efetivos não totalmente mapeado
- [ ] **`withTenantContext` com executor já transaccional** — comportamento estático não conclusivo
- [ ] **Derivação `getSessionTenantId`** — implementação não lida integralmente
- [ ] **Queries sem filtro tenantId** em rotas não inspecionadas

## J) Decisão GO/NO-GO fundamentada

**DECISÃO: NO-GO**

### Fundamentação
1. **Cobertura insuficiente:** Apenas ~30-35% dos ficheiros efetivamente analisados. Auditoria não completa.
2. **Validação tenant não comprovada:** Em múltiplas rotas críticas (`customers`, `produtos`, `stock`) não foi demonstrado que `tenantId` é exclusivamente derivado da sessão com comparação efetiva.
3. **Fragilidades de design confirmadas:** `runAsAdmin`/`runAsSystem` sem validação interna; `runWithTenant` permite `isAdmin:true`; definição manual de GUCs em `ad-unlock-service.ts`.
4. **Risco cross-tenant:** `runAsSystem` utilizado em fluxos intencionais (cron/register/adapter) mas sem guarda central e com cobertura RLS não totalmente cruzada.
5. **Admin não totalmente verificado:** Guards existem mas uso obrigatório não demonstrado em todas as operações privilegiadas.
6. **Políticas RLS não completamente mapeadas:** Correspondência aplicação↔políticas não comprovada para todos os caminhos.

### Condições para reavaliação a GO
- Ler **integralmente** todos os 60 `route.ts` (todos os métodos)
- Demonstrar derivação exclusiva do `tenantId` da sessão em **todas** as rotas multi-tenant
- Completar mapeamento **tabela → política RLS → helper → caminho Prisma**
- Investigar e classificar **todos** os Server Actions
- Demonstrar aplicação obrigatória dos guards administrativos
- Revisar comportamentos `withTenantContext` e fluxos pós-commit
- Eliminar ou proteger com validação central `runAsAdmin`/`runWithTenant(isAdmin:true)`

**Não existem evidências suficientes para declarar o sistema seguro. Mantém-se NO-GO. Nenhuma correção foi implementada nesta fase.**